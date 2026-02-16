"""
SpeakInsights v3 — Recording Models (composite + individual tracks)
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Float, Integer, BigInteger, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.database import Base


class Recording(Base):
    """Composite recording of the entire meeting."""
    __tablename__ = "recordings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    egress_id = Column(String(255), nullable=True)
    file_path = Column(Text, nullable=True)
    file_url = Column(Text, nullable=True)
    file_size = Column(BigInteger, nullable=True)
    duration = Column(Float, nullable=True)  # seconds
    format = Column(String(20), default="mp4")
    status = Column(
        SAEnum("recording", "processing", "completed", "failed", name="recording_status"),
        default="recording",
        nullable=False,
    )
    metadata_ = Column("metadata", JSONB, default=dict)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    meeting = relationship("Meeting", back_populates="recordings")


class IndividualRecording(Base):
    """Individual audio track per participant for speaker attribution."""
    __tablename__ = "individual_recordings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_id = Column(UUID(as_uuid=True), ForeignKey("participants.id", ondelete="SET NULL"), nullable=True)
    speaker_name = Column(String(100), nullable=False)
    egress_id = Column(String(255), nullable=True)
    file_path = Column(Text, nullable=True)
    file_size = Column(BigInteger, nullable=True)
    duration = Column(Float, nullable=True)
    format = Column(String(20), default="ogg")
    status = Column(
        SAEnum("recording", "processing", "completed", "failed",
               name="individual_recording_status"),
        default="recording",
        nullable=False,
    )
    transcription_status = Column(String(20), default="pending")  # pending, processing, completed
    metadata_ = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    meeting = relationship("Meeting", back_populates="individual_recordings")
