"""
SpeakInsights v3 — Recording Routes
List, stream, and download meeting recordings (composite + individual tracks).
"""

import logging
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings
from app.core.recording_manager import recording_manager
from app.models.meeting import Meeting
from app.models.recording import IndividualRecording, Recording

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /{meeting_id} — list all recordings
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}")
async def list_recordings(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """List all recordings for a meeting (composite, individual, screen shares)."""
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Composite recordings from DB
    comp_result = await db.execute(
        select(Recording).where(Recording.meeting_id == meeting_id)
    )
    composites = comp_result.scalars().all()

    # Individual recordings from DB
    ind_result = await db.execute(
        select(IndividualRecording).where(IndividualRecording.meeting_id == meeting_id)
    )
    individuals = ind_result.scalars().all()

    # Also list files on disk
    disk_files = recording_manager.list_meeting_recordings(str(meeting_id))

    return {
        "meeting_id": str(meeting_id),
        "composite": [
            {
                "id": str(r.id),
                "egress_id": r.egress_id,
                "status": r.status,
                "format": r.format,
                "file_size": r.file_size,
                "duration": r.duration,
                "file_path": r.file_path,
            }
            for r in composites
        ],
        "individual_tracks": [
            {
                "id": str(r.id),
                "speaker_name": r.speaker_name,
                "status": r.status,
                "format": r.format,
                "file_size": r.file_size,
                "duration": r.duration,
                "transcription_status": r.transcription_status,
            }
            for r in individuals
        ],
        "disk_files": disk_files,
    }


# ---------------------------------------------------------------------------
# GET /{meeting_id}/composite — stream composite video
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}/composite")
async def stream_composite(
    meeting_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Stream/serve the composite video file with range request support for video seeking."""
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Meeting not found")

    file_path = recording_manager.get_recording_path(str(meeting_id), "composite")

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Composite recording not found on disk")

    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("range")

    if range_header:
        # Parse range header: "bytes=start-end"
        range_str = range_header.replace("bytes=", "")
        parts = range_str.split("-")
        start = int(parts[0])
        end = int(parts[1]) if parts[1] else file_size - 1
        length = end - start + 1

        def iter_file():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk_size = min(65536, remaining)
                    data = f.read(chunk_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return StreamingResponse(
            iter_file(),
            status_code=206,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
                "Content-Type": "video/mp4",
            },
        )

    # No range — serve full file
    return FileResponse(
        file_path,
        media_type="video/mp4",
        headers={"Accept-Ranges": "bytes"},
    )


# ---------------------------------------------------------------------------
# GET /{meeting_id}/tracks — list individual audio tracks
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}/tracks")
async def list_tracks(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """List individual audio tracks with participant names."""
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Meeting not found")

    result = await db.execute(
        select(IndividualRecording).where(IndividualRecording.meeting_id == meeting_id)
    )
    tracks = result.scalars().all()

    return {
        "meeting_id": str(meeting_id),
        "tracks": [
            {
                "id": str(t.id),
                "speaker_name": t.speaker_name,
                "status": t.status,
                "format": t.format,
                "file_size": t.file_size,
                "duration": t.duration,
                "transcription_status": t.transcription_status,
            }
            for t in tracks
        ],
    }


# ---------------------------------------------------------------------------
# GET /{meeting_id}/tracks/{participant_name} — serve individual track
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}/tracks/{participant_name}")
async def serve_track(
    meeting_id: uuid.UUID,
    participant_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Serve an individual participant audio track."""
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Meeting not found")

    file_path = recording_manager.get_individual_track_path(str(meeting_id), participant_name)

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail=f"Audio track not found for '{participant_name}'")

    return FileResponse(file_path, media_type="audio/ogg", filename=f"{participant_name}.ogg")


# ---------------------------------------------------------------------------
# GET /{meeting_id}/download — download composite recording
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}/download")
async def download_composite(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Download the composite recording as an attachment."""
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = meeting_result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    file_path = recording_manager.get_recording_path(str(meeting_id), "composite")

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Composite recording not found")

    filename = f"{meeting.title.replace(' ', '_')}_recording.mp4"
    return FileResponse(
        file_path,
        media_type="video/mp4",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# GET /{meeting_id}/download/{recording_id} — download specific recording
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}/download/{recording_id}")
async def download_recording(
    meeting_id: uuid.UUID,
    recording_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Download a specific recording by its ID."""
    # Try composite first
    result = await db.execute(
        select(Recording).where(
            Recording.id == recording_id,
            Recording.meeting_id == meeting_id,
        )
    )
    recording = result.scalar_one_or_none()

    if recording and recording.file_path and os.path.isfile(recording.file_path):
        return FileResponse(
            recording.file_path,
            media_type=f"video/{recording.format}",
            filename=Path(recording.file_path).name,
            headers={"Content-Disposition": f'attachment; filename="{Path(recording.file_path).name}"'},
        )

    # Try individual recording
    ind_result = await db.execute(
        select(IndividualRecording).where(
            IndividualRecording.id == recording_id,
            IndividualRecording.meeting_id == meeting_id,
        )
    )
    ind_recording = ind_result.scalar_one_or_none()

    if ind_recording and ind_recording.file_path and os.path.isfile(ind_recording.file_path):
        return FileResponse(
            ind_recording.file_path,
            media_type=f"audio/{ind_recording.format}",
            filename=Path(ind_recording.file_path).name,
            headers={"Content-Disposition": f'attachment; filename="{Path(ind_recording.file_path).name}"'},
        )

    raise HTTPException(status_code=404, detail="Recording file not found")

