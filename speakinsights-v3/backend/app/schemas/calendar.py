"""
SpeakInsights v3 — Calendar Export Schemas
"""

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class CalendarExportRequest(BaseModel):
    """Schema for requesting a calendar export."""
    meeting_id: UUID
    task_ids: Optional[list[UUID]] = None  # Specific tasks, or all if None


class CalendarExportResponse(BaseModel):
    """Schema for calendar export response."""
    id: UUID
    meeting_id: UUID
    file_url: str
    export_type: str = "ics"
    tasks_included: Optional[list] = None
    created_at: datetime

    model_config = {"from_attributes": True}
