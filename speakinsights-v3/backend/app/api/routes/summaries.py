"""
SpeakInsights v3 — Summary & Task Routes
Summary generation, task management, and sentiment analysis.
"""

import json
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings
from app.core.ollama_client import ollama_client
from app.core.sentiment_service import sentiment_service
from app.models.meeting import Meeting
from app.models.summary import Summary
from app.models.task import Task
from app.models.transcription import TranscriptionSegment
from app.schemas.summary import (
    SentimentResponse,
    SpeakerSentiment,
    SummaryResponse,
    TaskResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /{meeting_id}/generate — trigger summary generation via Ollama
# ---------------------------------------------------------------------------

@router.post("/{meeting_id}/generate", response_model=list[SummaryResponse], status_code=201)
async def generate_summary(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Trigger summary generation via Ollama for a meeting.

    Retrieves the full transcript, sends it to Ollama for:
    - Executive summary + key points + decisions
    - Task/action-item extraction
    - Per-speaker sentiment analysis

    Saves all results to the database and returns the summaries.
    """
    # Verify meeting
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = meeting_result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Build transcript text
    seg_result = await db.execute(
        select(TranscriptionSegment)
        .where(TranscriptionSegment.meeting_id == meeting_id)
        .order_by(TranscriptionSegment.start_time)
    )
    segments = seg_result.scalars().all()

    if not segments:
        raise HTTPException(status_code=400, detail="No transcript available for this meeting")

    # Build merged transcript string
    lines = []
    speaker_names = set()
    for seg in segments:
        speaker_names.add(seg.speaker_name)
        minutes = int(seg.start_time // 60)
        seconds = int(seg.start_time % 60)
        lines.append(f"[{minutes:02d}:{seconds:02d}] {seg.speaker_name}: {seg.text}")
    transcript_text = "\n".join(lines)

    # --- Step 1: Summarise ---
    try:
        summary_data = await ollama_client.summarize_transcript(transcript_text, meeting.title)
    except Exception as exc:
        logger.error("Summary generation failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Ollama summarization failed: {exc}")

    created_summaries = []

    # Executive summary
    exec_summary = Summary(
        id=uuid.uuid4(),
        meeting_id=meeting_id,
        summary_type="executive",
        content=summary_data.get("executive_summary", ""),
        structured_data=summary_data,
        model_used=summary_data.get("_model", settings.OLLAMA_MODEL),
        generation_time=datetime.utcnow(),
    )
    db.add(exec_summary)
    created_summaries.append(exec_summary)

    # Key points
    kp_summary = Summary(
        id=uuid.uuid4(),
        meeting_id=meeting_id,
        summary_type="key_points",
        content="\n".join(summary_data.get("key_points", [])),
        structured_data={"key_points": summary_data.get("key_points", [])},
        model_used=summary_data.get("_model", settings.OLLAMA_MODEL),
        generation_time=datetime.utcnow(),
    )
    db.add(kp_summary)
    created_summaries.append(kp_summary)

    # Decisions
    dec_summary = Summary(
        id=uuid.uuid4(),
        meeting_id=meeting_id,
        summary_type="decisions",
        content="\n".join(summary_data.get("decisions_made", [])),
        structured_data={"decisions_made": summary_data.get("decisions_made", [])},
        model_used=summary_data.get("_model", settings.OLLAMA_MODEL),
        generation_time=datetime.utcnow(),
    )
    db.add(dec_summary)
    created_summaries.append(dec_summary)

    # --- Step 2: Extract tasks ---
    try:
        tasks_data = await ollama_client.extract_tasks(transcript_text)
        for task_item in tasks_data:
            due_date = None
            if task_item.get("due_date"):
                try:
                    from datetime import date as date_cls
                    due_date = date_cls.fromisoformat(task_item["due_date"])
                except (ValueError, TypeError):
                    due_date = None

            priority = task_item.get("priority", "medium")
            if priority not in ("low", "medium", "high", "critical"):
                priority = "medium"

            db.add(Task(
                id=uuid.uuid4(),
                meeting_id=meeting_id,
                title=task_item.get("title", "Untitled Task"),
                description=task_item.get("context", ""),
                assignee=task_item.get("assignee"),
                due_date=due_date,
                priority=priority,
                status="pending",
            ))
    except Exception as exc:
        logger.warning("Task extraction failed: %s", exc)

    # --- Step 3: Deep sentiment ---
    try:
        sentiment_data = await ollama_client.analyze_sentiment(
            transcript_text, sorted(speaker_names)
        )
        sentiment_summary = Summary(
            id=uuid.uuid4(),
            meeting_id=meeting_id,
            summary_type="sentiment",
            content=str(sentiment_data.get("overall_sentiment", "")),
            structured_data=sentiment_data,
            model_used=settings.OLLAMA_MODEL,
            generation_time=datetime.utcnow(),
        )
        db.add(sentiment_summary)
        created_summaries.append(sentiment_summary)
    except Exception as exc:
        logger.warning("Sentiment analysis failed: %s", exc)

    await db.flush()

    logger.info("Generated summaries for meeting %s", meeting_id)
    return [SummaryResponse.model_validate(s) for s in created_summaries]


# ---------------------------------------------------------------------------
# GET /{meeting_id} — get summaries for a meeting
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}", response_model=list[SummaryResponse])
async def get_summaries(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all summaries for a meeting."""
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Meeting not found")

    result = await db.execute(
        select(Summary)
        .where(Summary.meeting_id == meeting_id)
        .order_by(Summary.created_at)
    )
    summaries = result.scalars().all()

    return [SummaryResponse.model_validate(s) for s in summaries]


# ---------------------------------------------------------------------------
# GET /{meeting_id}/tasks — get tasks for a meeting
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}/tasks", response_model=list[TaskResponse])
async def get_tasks(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all action items/tasks extracted for a meeting."""
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Meeting not found")

    result = await db.execute(
        select(Task)
        .where(Task.meeting_id == meeting_id)
        .order_by(Task.created_at)
    )
    tasks = result.scalars().all()

    return [TaskResponse.model_validate(t) for t in tasks]


# ---------------------------------------------------------------------------
# PUT /tasks/{task_id} — update a task
# ---------------------------------------------------------------------------

@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    status: str | None = None,
    priority: str | None = None,
    assignee: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Update task status, priority, or assignee."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if status is not None:
        valid_statuses = ("pending", "in_progress", "completed", "cancelled")
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Use one of: {valid_statuses}")
        task.status = status

    if priority is not None:
        valid_priorities = ("low", "medium", "high", "critical")
        if priority not in valid_priorities:
            raise HTTPException(status_code=400, detail=f"Invalid priority. Use one of: {valid_priorities}")
        task.priority = priority

    if assignee is not None:
        task.assignee = assignee

    task.updated_at = datetime.utcnow()
    await db.flush()

    logger.info("Updated task %s", task_id)
    return TaskResponse.model_validate(task)


# ---------------------------------------------------------------------------
# GET /{meeting_id}/sentiment — sentiment analysis
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}/sentiment", response_model=SentimentResponse)
async def get_sentiment(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get sentiment analysis for a meeting: overall, per-speaker, and arc timeline."""
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Get per-speaker sentiment from transcript segments (VADER)
    result = await db.execute(
        select(
            TranscriptionSegment.speaker_name,
            func.count(TranscriptionSegment.id).label("segment_count"),
            func.avg(TranscriptionSegment.sentiment_score).label("avg_score"),
        )
        .where(TranscriptionSegment.meeting_id == meeting_id)
        .group_by(TranscriptionSegment.speaker_name)
    )
    speaker_rows = result.all()

    speakers = []
    overall_scores = []
    for row in speaker_rows:
        avg = float(row.avg_score or 0)
        label = "positive" if avg >= 0.05 else ("negative" if avg <= -0.05 else "neutral")
        overall_scores.append(avg)

        # Get sentiment arc for this speaker
        arc_result = await db.execute(
            select(TranscriptionSegment.start_time, TranscriptionSegment.sentiment_score)
            .where(
                TranscriptionSegment.meeting_id == meeting_id,
                TranscriptionSegment.speaker_name == row.speaker_name,
            )
            .order_by(TranscriptionSegment.start_time)
        )
        arc = [{"time": r.start_time, "score": r.sentiment_score} for r in arc_result.all()]

        speakers.append(SpeakerSentiment(
            speaker_name=row.speaker_name,
            average_score=round(avg, 4),
            label=label,
            segment_count=row.segment_count,
            sentiment_arc=arc,
        ))

    # Overall sentiment
    overall_score = sum(overall_scores) / len(overall_scores) if overall_scores else 0.0
    overall_label = "positive" if overall_score >= 0.05 else ("negative" if overall_score <= -0.05 else "neutral")

    # Overall meeting sentiment arc
    arc_result = await db.execute(
        select(TranscriptionSegment.start_time, TranscriptionSegment.sentiment_score)
        .where(TranscriptionSegment.meeting_id == meeting_id)
        .order_by(TranscriptionSegment.start_time)
    )
    meeting_arc = [{"time": r.start_time, "score": r.sentiment_score} for r in arc_result.all()]

    return SentimentResponse(
        meeting_id=meeting_id,
        overall_score=round(overall_score, 4),
        overall_label=overall_label,
        speakers=speakers,
        sentiment_arc=meeting_arc,
    )

