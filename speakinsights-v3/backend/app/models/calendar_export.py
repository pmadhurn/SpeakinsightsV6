"""
SpeakInsights v3 — Calendar Export Model
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.database import Base


class CalendarExport(Base):
    __tablename__ = "calendar_exports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(Text, nullable=False)
    file_url = Column(Text, nullable=True)
    export_type = Column(String(20), default="ics")  # ics
    tasks_included = Column(JSONB, nullable=True)  # List of task IDs included
    metadata_ = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    meeting = relationship("Meeting", back_populates="calendar_exports")
