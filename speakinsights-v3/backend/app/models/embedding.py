"""
SpeakInsights v3 — Transcript Embedding Model (pgvector)
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import relationship

from app.db.database import Base


class TranscriptEmbedding(Base):
    __tablename__ = "transcript_embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("transcription_segments.id", ondelete="CASCADE"), nullable=True)
    chunk_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    speaker_name = Column(String(100), nullable=True)
    start_time = Column(Float, nullable=True)
    end_time = Column(Float, nullable=True)
    embedding = Column(Vector(768), nullable=False)  # nomic-embed-text dimension
    model_used = Column(String(100), default="nomic-embed-text")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    meeting = relationship("Meeting", back_populates="transcript_embeddings")
