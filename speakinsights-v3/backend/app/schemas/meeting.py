"""
SpeakInsights v3 — Meeting Schemas
"""

from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import Optional


class MeetingCreate(BaseModel):
    """Schema for creating a new meeting."""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    language: str = Field(default="auto", max_length=10)
    host_name: str = Field(..., min_length=1, max_length=100)


class MeetingResponse(BaseModel):
    """Schema for meeting response."""
    id: UUID
    title: str
    description: Optional[str] = None
    code: str
    language: str
    status: str
    host_name: str
    max_participants: int
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    participant_count: int = 0

    model_config = {"from_attributes": True}


class MeetingListResponse(BaseModel):
    """Schema for paginated meeting list."""
    meetings: list[MeetingResponse]
    total: int
    page: int = 1
    per_page: int = 20


class JoinRequest(BaseModel):
    """Schema for joining a meeting."""
    display_name: str = Field(..., min_length=1, max_length=100)


class JoinResponse(BaseModel):
    """Schema for join meeting response (after host approval)."""
    token: str
    room_id: str
    livekit_url: str
    participant_id: UUID


class ParticipantResponse(BaseModel):
    """Schema for participant response."""
    id: UUID
    display_name: str
    is_host: bool
    is_approved: bool
    is_active: bool
    joined_at: Optional[datetime] = None
    left_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
