"""
SpeakInsights v3 — Participant Model
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.database import Base


class Participant(Base):
    __tablename__ = "participants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    livekit_identity = Column(String(255), nullable=True)
    is_host = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    metadata_ = Column("metadata", JSONB, default=dict)
    joined_at = Column(DateTime, nullable=True)
    left_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    meeting = relationship("Meeting", back_populates="participants")
    transcription_segments = relationship("TranscriptionSegment", back_populates="participant")
