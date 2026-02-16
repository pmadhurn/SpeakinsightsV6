"""
SpeakInsights v3 — AI Chat Routes
Chat with Ollama, with optional RAG using pgvector transcript embeddings.
Supports both synchronous and Server-Sent Events (SSE) streaming.
"""

import json
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select, delete, func, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings
from app.core.ollama_client import ollama_client
from app.models.chat import ChatMessage
from app.models.embedding import TranscriptEmbedding
from app.schemas.chat import (
    ChatHistoryResponse,
    ChatMessageResponse,
    ChatRequest,
    ChatResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _do_rag_search(
    question: str,
    meeting_ids: list[uuid.UUID],
    db: AsyncSession,
    top_k: int = 5,
) -> list[dict]:
    """Embed the question and search pgvector for similar transcript chunks."""
    # Generate query embedding
    query_embedding = await ollama_client.generate_embedding(question)

    if not query_embedding:
        return []

    # Build pgvector similarity search using L2 distance
    from pgvector.sqlalchemy import Vector

    query = (
        select(
            TranscriptEmbedding.chunk_text,
            TranscriptEmbedding.speaker_name,
            TranscriptEmbedding.start_time,
            TranscriptEmbedding.end_time,
            TranscriptEmbedding.meeting_id,
            TranscriptEmbedding.embedding.l2_distance(query_embedding).label("distance"),
        )
        .where(TranscriptEmbedding.meeting_id.in_(meeting_ids))
        .order_by("distance")
        .limit(top_k)
    )

    result = await db.execute(query)
    rows = result.all()

    sources = []
    for row in rows:
        sources.append({
            "text": row.chunk_text,
            "speaker": row.speaker_name,
            "start_time": row.start_time,
            "end_time": row.end_time,
            "meeting_id": str(row.meeting_id),
            "distance": float(row.distance),
        })

    return sources


def _build_rag_messages(
    user_message: str,
    context_sources: list[dict],
    history: list[dict] | None = None,
) -> list[dict[str, str]]:
    """Build chat messages with RAG context injected as a system prompt."""
    context_text = "\n\n".join(
        f"[{src['speaker']}] {src['text']}" for src in context_sources
    )

    system_prompt = (
        "You are SpeakInsights, an AI assistant that answers questions about meetings. "
        "Use the following transcript excerpts as context to answer the user's question. "
        "If the context doesn't contain relevant information, say so honestly.\n\n"
        f"--- Meeting Transcript Context ---\n{context_text}\n--- End Context ---"
    )

    messages = [{"role": "system", "content": system_prompt}]

    if history:
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})
    return messages


def _build_direct_messages(
    user_message: str,
    history: list[dict] | None = None,
) -> list[dict[str, str]]:
    """Build chat messages without RAG context."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are SpeakInsights, a helpful AI assistant for meeting analysis. "
                "Answer questions clearly and concisely."
            ),
        }
    ]

    if history:
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})
    return messages


# ---------------------------------------------------------------------------
# POST / — send chat message (synchronous)
# ---------------------------------------------------------------------------

@router.post("", response_model=ChatResponse, status_code=201)
async def send_chat_message(
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send a chat message to Ollama and get a response.

    If RAG is enabled and meeting_ids are provided, embeds the question,
    searches pgvector for similar transcript chunks, and includes them
    as context for the LLM.
    """
    session_id = data.session_id or str(uuid.uuid4())
    model = data.model or settings.OLLAMA_MODEL
    context_sources = None

    # Get chat history for this session (last 10 messages)
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    )
    history_msgs = list(reversed(history_result.scalars().all()))
    history = [{"role": m.role, "content": m.content} for m in history_msgs]

    # RAG path
    if data.use_rag and data.meeting_ids:
        context_sources = await _do_rag_search(data.message, data.meeting_ids, db)
        messages = _build_rag_messages(data.message, context_sources, history)
    else:
        messages = _build_direct_messages(data.message, history)

    # Call Ollama
    try:
        result = await ollama_client.chat(messages, model=model)
    except Exception as exc:
        logger.error("Ollama chat failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"LLM service error: {exc}")

    assistant_content = result.get("response", "")

    # Save user message
    user_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session_id,
        meeting_id=data.meeting_ids[0] if data.meeting_ids else None,
        role="user",
        content=data.message,
        model_used=model,
        is_rag=bool(data.use_rag and data.meeting_ids),
    )
    db.add(user_msg)

    # Save assistant message
    assistant_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session_id,
        meeting_id=data.meeting_ids[0] if data.meeting_ids else None,
        role="assistant",
        content=assistant_content,
        model_used=model,
        is_rag=bool(data.use_rag and data.meeting_ids),
        context_chunks=context_sources,
    )
    db.add(assistant_msg)
    await db.flush()

    logger.info("Chat response generated (session=%s, rag=%s)", session_id, bool(context_sources))

    return ChatResponse(
        message=ChatMessageResponse.model_validate(assistant_msg),
        context_sources=context_sources,
    )


# ---------------------------------------------------------------------------
# POST /stream — streaming chat via SSE
# ---------------------------------------------------------------------------

@router.post("/stream")
async def stream_chat_message(
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """Stream a chat response as Server-Sent Events (SSE).

    Same logic as POST / but returns tokens as they arrive from Ollama.
    """
    session_id = data.session_id or str(uuid.uuid4())
    model = data.model or settings.OLLAMA_MODEL
    context_sources = None

    # Get chat history
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    )
    history_msgs = list(reversed(history_result.scalars().all()))
    history = [{"role": m.role, "content": m.content} for m in history_msgs]

    # RAG path
    if data.use_rag and data.meeting_ids:
        context_sources = await _do_rag_search(data.message, data.meeting_ids, db)
        messages = _build_rag_messages(data.message, context_sources, history)
    else:
        messages = _build_direct_messages(data.message, history)

    # Save user message immediately
    user_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session_id,
        meeting_id=data.meeting_ids[0] if data.meeting_ids else None,
        role="user",
        content=data.message,
        model_used=model,
        is_rag=bool(data.use_rag and data.meeting_ids),
    )
    db.add(user_msg)
    await db.flush()

    async def event_generator():
        """Generate SSE events with Ollama streaming tokens."""
        full_response = []

        # Send context sources first if RAG
        if context_sources:
            yield f"data: {json.dumps({'type': 'context', 'sources': context_sources})}\n\n"

        try:
            async for token in ollama_client.chat_stream(messages, model=model):
                full_response.append(token)
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
            return

        # Save assistant message after streaming completes
        assistant_content = "".join(full_response)
        try:
            from app.db.database import async_session_factory
            async with async_session_factory() as save_db:
                save_db.add(ChatMessage(
                    id=uuid.uuid4(),
                    session_id=session_id,
                    meeting_id=data.meeting_ids[0] if data.meeting_ids else None,
                    role="assistant",
                    content=assistant_content,
                    model_used=model,
                    is_rag=bool(data.use_rag and data.meeting_ids),
                    context_chunks=context_sources,
                ))
                await save_db.commit()
        except Exception as exc:
            logger.error("Failed to save streamed response: %s", exc)

        yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# GET /history/{session_id} — chat history
# ---------------------------------------------------------------------------

@router.get("/history/{session_id}", response_model=ChatHistoryResponse)
async def get_chat_history(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get chat history for a session, ordered by created_at."""
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()

    return ChatHistoryResponse(
        session_id=session_id,
        messages=[ChatMessageResponse.model_validate(m) for m in messages],
        total=len(messages),
    )


# ---------------------------------------------------------------------------
# GET /sessions — list all chat sessions
# ---------------------------------------------------------------------------

@router.get("/sessions")
async def list_chat_sessions(
    db: AsyncSession = Depends(get_db),
):
    """List all chat sessions with their first message as preview."""
    # Get distinct session IDs
    result = await db.execute(
        select(
            ChatMessage.session_id,
            func.min(ChatMessage.created_at).label("started_at"),
            func.count(ChatMessage.id).label("message_count"),
        )
        .group_by(ChatMessage.session_id)
        .order_by(func.max(ChatMessage.created_at).desc())
    )
    sessions = result.all()

    session_list = []
    for session in sessions:
        # Get first user message as preview
        first_msg = await db.execute(
            select(ChatMessage)
            .where(
                ChatMessage.session_id == session.session_id,
                ChatMessage.role == "user",
            )
            .order_by(ChatMessage.created_at)
            .limit(1)
        )
        first = first_msg.scalar_one_or_none()

        session_list.append({
            "session_id": session.session_id,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "message_count": session.message_count,
            "preview": first.content[:100] if first else "",
        })

    return {"sessions": session_list, "total": len(session_list)}


# ---------------------------------------------------------------------------
# DELETE /history/{session_id} — delete a chat session
# ---------------------------------------------------------------------------

@router.delete("/history/{session_id}", status_code=204)
async def delete_chat_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a chat session and all its messages."""
    result = await db.execute(
        select(func.count(ChatMessage.id)).where(ChatMessage.session_id == session_id)
    )
    count = result.scalar() or 0

    if count == 0:
        raise HTTPException(status_code=404, detail="Chat session not found")

    await db.execute(
        delete(ChatMessage).where(ChatMessage.session_id == session_id)
    )
    await db.flush()

    logger.info("Deleted chat session %s (%d messages)", session_id, count)
    return None

