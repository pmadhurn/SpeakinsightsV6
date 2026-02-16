"""
SpeakInsights v3 — AI Chat Routes
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db
from app.models.chat import ChatMessage
from app.schemas.chat import ChatRequest, ChatResponse, ChatMessageResponse, ChatHistoryResponse

router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def send_message(
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send a message to the AI chat (with optional RAG context)."""
    session_id = data.session_id or str(uuid.uuid4())

    # Save user message
    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=data.message,
        is_rag=data.use_rag,
    )
    if data.meeting_ids and len(data.meeting_ids) > 0:
        user_msg.meeting_id = data.meeting_ids[0]
    db.add(user_msg)
    await db.flush()

    # TODO: Implement actual Ollama chat + RAG pipeline
    # For now, return a stub response
    assistant_msg = ChatMessage(
        session_id=session_id,
        meeting_id=user_msg.meeting_id,
        role="assistant",
        content="AI chat is not yet implemented. This is a placeholder response.",
        model_used=data.model or "llama3.2:3b",
        is_rag=data.use_rag,
    )
    db.add(assistant_msg)
    await db.flush()

    return ChatResponse(
        message=ChatMessageResponse.model_validate(assistant_msg),
        context_sources=None,
    )


@router.get("/history/{session_id}", response_model=ChatHistoryResponse)
async def get_chat_history(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get chat history for a session."""
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
