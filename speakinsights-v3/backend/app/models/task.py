"""
SpeakInsights v3 — Task Model (extracted action items)
"""

import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Text, DateTime, Date, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    assignee = Column(String(100), nullable=True)
    due_date = Column(Date, nullable=True)
    priority = Column(
        SAEnum("low", "medium", "high", "critical", name="task_priority"),
        default="medium",
        nullable=True,
    )
    status = Column(
        SAEnum("pending", "in_progress", "completed", "cancelled", name="task_status"),
        default="pending",
        nullable=False,
    )
    source_segment_id = Column(UUID(as_uuid=True), nullable=True)  # Reference to transcript segment
    metadata_ = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    meeting = relationship("Meeting", back_populates="tasks")
