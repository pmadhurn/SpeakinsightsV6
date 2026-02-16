"""
SpeakInsights v3 — Transcription Segment Model
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Float, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.database import Base


class TranscriptionSegment(Base):
    __tablename__ = "transcription_segments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_id = Column(UUID(as_uuid=True), ForeignKey("participants.id", ondelete="SET NULL"), nullable=True)
    speaker_name = Column(String(100), nullable=False)
    text = Column(Text, nullable=False)
    language = Column(String(10), nullable=True)
    start_time = Column(Float, nullable=False)  # seconds from meeting start
    end_time = Column(Float, nullable=False)
    confidence = Column(Float, nullable=True)
    sentiment_score = Column(Float, nullable=True)  # VADER compound score -1 to 1
    sentiment_label = Column(String(20), nullable=True)  # positive, negative, neutral
    word_count = Column(Integer, nullable=True)
    source = Column(String(20), default="live")  # "live" or "post_processing"
    metadata_ = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    meeting = relationship("Meeting", back_populates="transcription_segments")
    participant = relationship("Participant", back_populates="transcription_segments")
