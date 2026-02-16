"""
SpeakInsights v3 — Summary & Task Schemas
"""

from pydantic import BaseModel, Field
from datetime import datetime, date
from uuid import UUID
from typing import Optional, Any


class SummaryResponse(BaseModel):
    """Schema for a meeting summary."""
    id: UUID
    meeting_id: UUID
    summary_type: str
    content: Optional[str] = None
    structured_data: Optional[Any] = None
    model_used: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class TaskCreate(BaseModel):
    """Schema for creating a task."""
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[date] = None
    priority: str = "medium"


class TaskResponse(BaseModel):
    """Schema for task response."""
    id: UUID
    meeting_id: UUID
    title: str
    description: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[date] = None
    priority: Optional[str] = "medium"
    status: str = "pending"
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SpeakerSentiment(BaseModel):
    """Sentiment analysis for a single speaker."""
    speaker_name: str
    average_score: float
    label: str  # positive, negative, neutral
    segment_count: int
    sentiment_arc: list[dict] = []  # [{time, score}] over time


class SentimentResponse(BaseModel):
    """Schema for meeting sentiment analysis."""
    meeting_id: UUID
    overall_score: float
    overall_label: str
    speakers: list[SpeakerSentiment]
    sentiment_arc: list[dict] = []
