"""
SpeakInsights v3 — Transcription Routes
Audio chunk upload, full transcript retrieval, timeline view, search, speaker stats.
"""

import glob
import json
import logging
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy import func, select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings
from app.core.sentiment_service import sentiment_service
from app.core.whisperx_client import whisperx_client
from app.models.meeting import Meeting
from app.models.participant import Participant
from app.models.transcription import TranscriptionSegment
from app.schemas.transcription import (
    FullTranscriptResponse,
    SpeakerTimeline,
    TranscriptSegmentResponse,
    TranscriptTimelineResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_recording_offset(meeting_id: uuid.UUID, meeting: Meeting) -> float:
    """Calculate the offset between meeting start and recording start.
    
    The egress (recording) typically starts 15-25 seconds after the meeting
    starts because it waits for audio/video tracks to be published.
    Transcript timestamps are relative to meeting start, but video timestamps
    are relative to recording start. This function returns the number of
    seconds to subtract from transcript timestamps to align them with video.
    
    Returns:
        Offset in seconds (0.0 if no recording metadata found).
    """
    if not meeting.started_at:
        return 0.0

    # Look for egress metadata JSON files
    rec_dir = os.path.join(settings.STORAGE_PATH, "recordings", str(meeting_id))
    if not os.path.isdir(rec_dir):
        return 0.0

    earliest_egress_start = None

    for json_file in glob.glob(os.path.join(rec_dir, "EG_*.json")):
        try:
            with open(json_file) as f:
                meta = json.load(f)
            started_at_ns = meta.get("started_at", 0)
            if started_at_ns:
                egress_start = datetime.fromtimestamp(started_at_ns / 1e9, tz=timezone.utc)
                if earliest_egress_start is None or egress_start < earliest_egress_start:
                    earliest_egress_start = egress_start
        except Exception:
            continue

    if earliest_egress_start is None:
        return 0.0

    # Ensure meeting.started_at is timezone-aware for comparison
    meeting_start = meeting.started_at
    if meeting_start is not None and meeting_start.tzinfo is None:
        meeting_start = meeting_start.replace(tzinfo=timezone.utc)

    if meeting_start is None:
        return 0.0

    offset = (earliest_egress_start - meeting_start).total_seconds()
    logger.debug(
        "Recording offset for meeting %s: %.1fs (egress started at %s, meeting at %s)",
        meeting_id, offset, earliest_egress_start, meeting.started_at,
    )
    return max(0.0, offset)  # Never negative


# ---------------------------------------------------------------------------
# POST /{meeting_id}/chunk — receive audio chunk for live transcription
# ---------------------------------------------------------------------------

@router.post("/{meeting_id}/chunk")
async def receive_audio_chunk(
    meeting_id: uuid.UUID,
    audio: UploadFile = File(...),
    participant_name: str = Form(...),
    timestamp_offset: float = Form(0.0),
    db: AsyncSession = Depends(get_db),
):
    """Receive an audio chunk, send to WhisperX for transcription.

    Runs VADER sentiment on each segment, saves to DB, and returns
    the transcribed segments.
    """
    # Verify meeting exists
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Read audio bytes
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Send to WhisperX
    try:
        segments = await whisperx_client.transcribe_audio_chunk(
            audio_bytes=audio_bytes,
            language=meeting.language or "auto",
            timestamp_offset=timestamp_offset,
        )
    except Exception as exc:
        logger.error("WhisperX transcription failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Transcription service error: {exc}")

    # Find participant (optional — may not exist yet)
    participant_result = await db.execute(
        select(Participant).where(
            Participant.meeting_id == meeting_id,
            Participant.display_name == participant_name,
        )
    )
    participant = participant_result.scalar_one_or_none()
    participant_id = participant.id if participant else None

    # Save each segment with sentiment
    saved_segments = []
    for seg in segments:
        text = seg.get("text", "").strip()
        if not text:
            continue

        sentiment = sentiment_service.analyze_segment(text)

        db_segment = TranscriptionSegment(
            id=uuid.uuid4(),
            meeting_id=meeting_id,
            participant_id=participant_id,
            speaker_name=participant_name,
            text=text,
            language=seg.get("language"),
            start_time=seg.get("start", 0.0),
            end_time=seg.get("end", 0.0),
            confidence=seg.get("confidence"),
            sentiment_score=sentiment["compound"],
            sentiment_label=sentiment["label"],
            word_count=len(text.split()),
            source="live",
            metadata_={"words": seg.get("words", [])},
        )
        db.add(db_segment)
        saved_segments.append(db_segment)

    await db.flush()

    logger.info(
        "Processed %d segments for meeting %s from %s",
        len(saved_segments), meeting_id, participant_name,
    )

    return {
        "segments": [TranscriptSegmentResponse.model_validate(s) for s in saved_segments],
        "count": len(saved_segments),
    }


# ---------------------------------------------------------------------------
# GET /{meeting_id} — full transcript
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}", response_model=FullTranscriptResponse)
async def get_full_transcript(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get the full transcript for a meeting, ordered by start_time.
    
    Timestamps are adjusted to align with the recording/video start time,
    not the meeting start time, so transcript segments sync with playback.
    """
    # Verify meeting
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = meeting_result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    result = await db.execute(
        select(TranscriptionSegment)
        .where(TranscriptionSegment.meeting_id == meeting_id)
        .order_by(TranscriptionSegment.start_time)
    )
    segments = result.scalars().all()

    # --- Calculate recording offset ---
    # Transcript timestamps are relative to meeting start, but the video
    # starts when egress begins (typically 15-25 seconds later).
    # We need to subtract this offset so timestamps match the video.
    recording_offset = _get_recording_offset(meeting_id, meeting)

    # Detect languages used
    lang_result = await db.execute(
        select(distinct(TranscriptionSegment.language))
        .where(TranscriptionSegment.meeting_id == meeting_id)
        .where(TranscriptionSegment.language.isnot(None))
    )
    languages = [row[0] for row in lang_result.all() if row[0]]

    # Build adjusted segments
    adjusted_segments = []
    for s in segments:
        seg_resp = TranscriptSegmentResponse.model_validate(s)
        seg_resp.start_time = max(0.0, s.start_time - recording_offset)
        seg_resp.end_time = max(0.0, s.end_time - recording_offset)
        adjusted_segments.append(seg_resp)

    total_duration = 0.0
    if adjusted_segments:
        total_duration = max(s.end_time for s in adjusted_segments) - min(s.start_time for s in adjusted_segments)

    return FullTranscriptResponse(
        meeting_id=meeting_id,
        segments=adjusted_segments,
        total_segments=len(adjusted_segments),
        total_duration=total_duration,
        languages=languages,
    )


# ---------------------------------------------------------------------------
# GET /{meeting_id}/timeline — grouped by speaker turns
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}/timeline", response_model=TranscriptTimelineResponse)
async def get_transcript_timeline(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get transcript grouped by speaker turns (consecutive segments by same speaker)."""
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Meeting not found")

    result = await db.execute(
        select(TranscriptionSegment)
        .where(TranscriptionSegment.meeting_id == meeting_id)
        .order_by(TranscriptionSegment.start_time)
    )
    segments = result.scalars().all()

    # Group consecutive segments by speaker
    speaker_groups: dict[str, list] = {}
    for seg in segments:
        name = seg.speaker_name
        if name not in speaker_groups:
            speaker_groups[name] = []
        speaker_groups[name].append(seg)

    speakers = []
    total_duration = 0.0
    for name, segs in speaker_groups.items():
        duration = sum(s.end_time - s.start_time for s in segs)
        words = sum(s.word_count or 0 for s in segs)
        total_duration += duration
        speakers.append(
            SpeakerTimeline(
                speaker_name=name,
                segments=[TranscriptSegmentResponse.model_validate(s) for s in segs],
                total_duration=round(duration, 2),
                total_words=words,
            )
        )

    return TranscriptTimelineResponse(
        meeting_id=meeting_id,
        speakers=speakers,
        total_segments=len(segments),
        total_duration=round(total_duration, 2),
    )


# ---------------------------------------------------------------------------
# GET /{meeting_id}/search — full text search
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}/search")
async def search_transcript(
    meeting_id: uuid.UUID,
    q: str = Query(..., min_length=1, description="Search query"),
    db: AsyncSession = Depends(get_db),
):
    """Full text search across transcript segments using ILIKE."""
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Meeting not found")

    result = await db.execute(
        select(TranscriptionSegment)
        .where(
            TranscriptionSegment.meeting_id == meeting_id,
            TranscriptionSegment.text.ilike(f"%{q}%"),
        )
        .order_by(TranscriptionSegment.start_time)
    )
    segments = result.scalars().all()

    return {
        "query": q,
        "meeting_id": str(meeting_id),
        "results": [TranscriptSegmentResponse.model_validate(s) for s in segments],
        "count": len(segments),
    }


# ---------------------------------------------------------------------------
# GET /{meeting_id}/speakers — speaker stats
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}/speakers")
async def get_speaker_stats(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get list of unique speakers with total speaking time and average sentiment."""
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Meeting not found")

    result = await db.execute(
        select(
            TranscriptionSegment.speaker_name,
            func.count(TranscriptionSegment.id).label("segment_count"),
            func.sum(TranscriptionSegment.end_time - TranscriptionSegment.start_time).label("total_speaking_time"),
            func.avg(TranscriptionSegment.sentiment_score).label("avg_sentiment"),
            func.sum(TranscriptionSegment.word_count).label("total_words"),
        )
        .where(TranscriptionSegment.meeting_id == meeting_id)
        .group_by(TranscriptionSegment.speaker_name)
        .order_by(func.sum(TranscriptionSegment.end_time - TranscriptionSegment.start_time).desc())
    )
    rows = result.all()

    speakers = []
    for row in rows:
        speakers.append({
            "speaker_name": row.speaker_name,
            "segment_count": row.segment_count,
            "total_speaking_time": round(float(row.total_speaking_time or 0), 2),
            "average_sentiment": round(float(row.avg_sentiment or 0), 4),
            "total_words": int(row.total_words or 0),
        })

    return {"meeting_id": str(meeting_id), "speakers": speakers}

