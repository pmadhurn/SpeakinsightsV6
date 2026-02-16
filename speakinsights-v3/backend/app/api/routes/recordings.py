"""
SpeakInsights v3 — Recording Routes
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db
from app.models.recording import Recording, IndividualRecording
from app.config import settings

router = APIRouter()


@router.get("/{meeting_id}")
async def get_recordings(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all recordings for a meeting."""
    result = await db.execute(
        select(Recording).where(Recording.meeting_id == meeting_id)
    )
    recordings = result.scalars().all()

    ind_result = await db.execute(
        select(IndividualRecording).where(IndividualRecording.meeting_id == meeting_id)
    )
    individual = ind_result.scalars().all()

    return {
        "meeting_id": str(meeting_id),
        "composite_recordings": [
            {
                "id": str(r.id),
                "file_url": r.file_url,
                "duration": r.duration,
                "format": r.format,
                "status": r.status,
                "file_size": r.file_size,
            }
            for r in recordings
        ],
        "individual_recordings": [
            {
                "id": str(r.id),
                "speaker_name": r.speaker_name,
                "duration": r.duration,
                "format": r.format,
                "status": r.status,
            }
            for r in individual
        ],
    }
