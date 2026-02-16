"""
SpeakInsights v3 — Meeting Model
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Enum as SAEnum, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.database import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    code = Column(String(20), unique=True, nullable=False, index=True)
    language = Column(String(10), default="auto")
    status = Column(
        SAEnum("waiting", "active", "processing", "completed", "failed",
               name="meeting_status"),
        default="waiting",
        nullable=False,
    )
    host_name = Column(String(100), nullable=False)
    host_participant_id = Column(UUID(as_uuid=True), nullable=True)
    livekit_room_name = Column(String(255), nullable=True)
    max_participants = Column(Integer, default=20)
    settings = Column(JSONB, default=dict)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    participants = relationship("Participant", back_populates="meeting", cascade="all, delete-orphan")
    transcription_segments = relationship("TranscriptionSegment", back_populates="meeting", cascade="all, delete-orphan")
    recordings = relationship("Recording", back_populates="meeting", cascade="all, delete-orphan")
    individual_recordings = relationship("IndividualRecording", back_populates="meeting", cascade="all, delete-orphan")
    summaries = relationship("Summary", back_populates="meeting", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="meeting", cascade="all, delete-orphan")
    transcript_embeddings = relationship("TranscriptEmbedding", back_populates="meeting", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="meeting", cascade="all, delete-orphan")
    calendar_exports = relationship("CalendarExport", back_populates="meeting", cascade="all, delete-orphan")
