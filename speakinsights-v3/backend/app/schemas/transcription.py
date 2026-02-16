"""
SpeakInsights v3 — Transcription Schemas
"""

from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Optional


class TranscriptSegmentResponse(BaseModel):
    """Schema for a single transcript segment."""
    id: UUID
    meeting_id: UUID
    speaker_name: str
    text: str
    language: Optional[str] = None
    start_time: float
    end_time: float
    confidence: Optional[float] = None
    sentiment_score: Optional[float] = None
    sentiment_label: Optional[str] = None
    word_count: Optional[int] = None
    source: str = "live"
    created_at: datetime

    model_config = {"from_attributes": True}


class SpeakerTimeline(BaseModel):
    """Transcript segments grouped by speaker."""
    speaker_name: str
    segments: list[TranscriptSegmentResponse]
    total_duration: float = 0.0
    total_words: int = 0


class TranscriptTimelineResponse(BaseModel):
    """Timeline view of transcript grouped by speaker."""
    meeting_id: UUID
    speakers: list[SpeakerTimeline]
    total_segments: int
    total_duration: float


class FullTranscriptResponse(BaseModel):
    """Full transcript as ordered segments."""
    meeting_id: UUID
    segments: list[TranscriptSegmentResponse]
    total_segments: int
    total_duration: float
    languages: list[str] = []


class TranscriptSegmentCreate(BaseModel):
    """Schema for creating a transcript segment (from WhisperX)."""
    speaker_name: str
    text: str
    language: Optional[str] = None
    start_time: float
    end_time: float
    confidence: Optional[float] = None
    source: str = "live"
