"""
SpeakInsights v3 — Transcription Routes
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import get_db
from app.models.transcription import TranscriptionSegment
from app.models.meeting import Meeting
from app.schemas.transcription import (
    TranscriptSegmentResponse,
    FullTranscriptResponse,
    TranscriptTimelineResponse,
    SpeakerTimeline,
)

router = APIRouter()


@router.get("/{meeting_id}", response_model=FullTranscriptResponse)
async def get_transcript(
    meeting_id: uuid.UUID,
    source: str = "all",
    db: AsyncSession = Depends(get_db),
):
    """Get the full transcript for a meeting."""
    # Verify meeting exists
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    query = (
        select(TranscriptionSegment)
        .where(TranscriptionSegment.meeting_id == meeting_id)
        .order_by(TranscriptionSegment.start_time)
    )
    if source != "all":
        query = query.where(TranscriptionSegment.source == source)

    result = await db.execute(query)
    segments = result.scalars().all()

    total_duration = 0.0
    languages = set()
    for seg in segments:
        total_duration = max(total_duration, seg.end_time)
        if seg.language:
            languages.add(seg.language)

    return FullTranscriptResponse(
        meeting_id=meeting_id,
        segments=[TranscriptSegmentResponse.model_validate(s) for s in segments],
        total_segments=len(segments),
        total_duration=total_duration,
        languages=list(languages),
    )


@router.get("/{meeting_id}/timeline", response_model=TranscriptTimelineResponse)
async def get_transcript_timeline(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get transcript grouped by speaker."""
    result = await db.execute(
        select(TranscriptionSegment)
        .where(TranscriptionSegment.meeting_id == meeting_id)
        .order_by(TranscriptionSegment.start_time)
    )
    segments = result.scalars().all()

    # Group by speaker
    speaker_map: dict[str, list] = {}
    total_duration = 0.0
    for seg in segments:
        total_duration = max(total_duration, seg.end_time)
        if seg.speaker_name not in speaker_map:
            speaker_map[seg.speaker_name] = []
        speaker_map[seg.speaker_name].append(seg)

    speakers = []
    for name, segs in speaker_map.items():
        dur = sum(s.end_time - s.start_time for s in segs)
        words = sum(s.word_count or 0 for s in segs)
        speakers.append(
            SpeakerTimeline(
                speaker_name=name,
                segments=[TranscriptSegmentResponse.model_validate(s) for s in segs],
                total_duration=dur,
                total_words=words,
            )
        )

    return TranscriptTimelineResponse(
        meeting_id=meeting_id,
        speakers=speakers,
        total_segments=len(segments),
        total_duration=total_duration,
    )
