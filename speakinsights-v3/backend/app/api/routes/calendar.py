"""
SpeakInsights v3 — Calendar Export Routes
Generate and serve .ics calendar files for meetings and tasks.
"""

import logging
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings
from app.core.calendar_generator import calendar_generator
from app.models.calendar_export import CalendarExport
from app.models.meeting import Meeting
from app.models.participant import Participant
from app.models.task import Task
from app.schemas.calendar import CalendarExportResponse

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /{meeting_id}/export — generate .ics file
# ---------------------------------------------------------------------------

@router.post("/{meeting_id}/export", response_model=CalendarExportResponse, status_code=201)
async def export_calendar(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate a .ics calendar file for a meeting with its tasks.

    Fetches meeting details and tasks from the database, generates a
    valid iCalendar file, stores it, and returns download info.
    """
    # Verify meeting
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Get tasks
    task_result = await db.execute(
        select(Task).where(Task.meeting_id == meeting_id)
    )
    tasks = task_result.scalars().all()

    # Get attendees
    part_result = await db.execute(
        select(Participant).where(Participant.meeting_id == meeting_id)
    )
    attendees = [p.display_name for p in part_result.scalars().all()]

    # Build tasks data for the generator
    tasks_data = []
    for t in tasks:
        tasks_data.append({
            "title": t.title,
            "assignee": t.assignee or "Unassigned",
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "priority": t.priority or "medium",
            "context": t.description or "",
        })

    # Generate .ics file
    try:
        duration_minutes = 60  # default
        if meeting.started_at and meeting.ended_at:
            duration_minutes = int(
                (meeting.ended_at - meeting.started_at).total_seconds() / 60
            )

        file_path, ics_content = calendar_generator.generate_ics(
            title=meeting.title,
            description=meeting.description or "",
            start_time=meeting.started_at or meeting.created_at,
            duration_minutes=max(duration_minutes, 1),
            attendees=attendees,
            tasks=tasks_data,
            meeting_id=str(meeting_id),
        )
    except Exception as exc:
        logger.error("Failed to generate .ics: %s", exc)
        raise HTTPException(status_code=500, detail=f"Calendar generation failed: {exc}")

    # Save export record
    export = CalendarExport(
        id=uuid.uuid4(),
        meeting_id=meeting_id,
        file_path=file_path,
        file_url=f"/api/calendar/{meeting_id}/ics",
        export_type="ics",
        tasks_included=[str(t.id) for t in tasks],
    )
    db.add(export)
    await db.flush()

    logger.info("Generated .ics export for meeting %s", meeting_id)
    return CalendarExportResponse.model_validate(export)


# ---------------------------------------------------------------------------
# GET /{meeting_id}/ics — serve the .ics file
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}/ics")
async def serve_ics(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Serve a previously generated .ics calendar file for download."""
    # Find the latest export
    result = await db.execute(
        select(CalendarExport)
        .where(CalendarExport.meeting_id == meeting_id)
        .order_by(CalendarExport.created_at.desc())
        .limit(1)
    )
    export = result.scalar_one_or_none()
    if not export:
        raise HTTPException(status_code=404, detail="No calendar export found for this meeting")

    if not export.file_path or not os.path.isfile(export.file_path):
        raise HTTPException(status_code=404, detail="Calendar file not found on disk")

    return FileResponse(
        export.file_path,
        media_type="text/calendar",
        filename=f"meeting_{meeting_id}.ics",
        headers={"Content-Disposition": f'attachment; filename="meeting_{meeting_id}.ics"'},
    )

