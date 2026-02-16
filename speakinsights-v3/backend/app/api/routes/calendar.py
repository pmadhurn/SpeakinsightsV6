"""
SpeakInsights v3 — Calendar Export Routes
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db
from app.models.calendar_export import CalendarExport
from app.models.meeting import Meeting
from app.schemas.calendar import CalendarExportRequest, CalendarExportResponse

router = APIRouter()


@router.post("/export", response_model=CalendarExportResponse, status_code=201)
async def export_calendar(
    data: CalendarExportRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate .ics calendar export for meeting tasks."""
    # Verify meeting exists
    result = await db.execute(select(Meeting).where(Meeting.id == data.meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # TODO: Generate actual .ics file using icalendar library
    # For now, return stub
    export = CalendarExport(
        meeting_id=data.meeting_id,
        file_path=f"/app/storage/exports/{data.meeting_id}.ics",
        file_url=f"/storage/exports/{data.meeting_id}.ics",
        export_type="ics",
        tasks_included=[str(t) for t in (data.task_ids or [])],
    )
    db.add(export)
    await db.flush()

    return CalendarExportResponse.model_validate(export)


@router.get("/{meeting_id}/exports", response_model=list[CalendarExportResponse])
async def get_exports(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all calendar exports for a meeting."""
    result = await db.execute(
        select(CalendarExport).where(CalendarExport.meeting_id == meeting_id)
    )
    exports = result.scalars().all()
    return [CalendarExportResponse.model_validate(e) for e in exports]
