"""
SpeakInsights v3 — Meeting Routes
Full CRUD + join/approve/decline/start/end workflows.
"""

import asyncio
import logging
import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings
from app.core.livekit_service import livekit_service
from app.core.post_processing import post_processing
from app.core.recording_manager import recording_manager
from app.models.meeting import Meeting
from app.models.participant import Participant
from app.models.recording import Recording
from app.schemas.meeting import (
    JoinRequest,
    JoinResponse,
    MeetingCreate,
    MeetingListResponse,
    MeetingResponse,
    ParticipantResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _generate_code() -> str:
    """Generate a unique meeting code like 'si-a1b2c3d4'."""
    return f"si-{secrets.token_hex(4)}"


async def _meeting_to_response(meeting: Meeting, db: AsyncSession) -> MeetingResponse:
    """Convert a Meeting ORM object to a MeetingResponse, including participant count."""
    count_result = await db.execute(
        select(func.count(Participant.id)).where(Participant.meeting_id == meeting.id)
    )
    participant_count = count_result.scalar() or 0

    return MeetingResponse(
        id=meeting.id,
        title=meeting.title,
        description=meeting.description,
        code=meeting.code,
        language=meeting.language,
        status=meeting.status,
        host_name=meeting.host_name,
        max_participants=meeting.max_participants,
        started_at=meeting.started_at,
        ended_at=meeting.ended_at,
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
        participant_count=participant_count,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("", response_model=MeetingResponse, status_code=201)
async def create_meeting(
    data: MeetingCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new meeting room.

    Generates a shareable room code, creates the host participant,
    and provisions a LiveKit room.
    """
    code = _generate_code()
    room_name = f"si-room-{code}"

    # Create meeting record
    meeting = Meeting(
        id=uuid.uuid4(),
        title=data.title,
        description=data.description,
        code=code,
        language=data.language,
        status="waiting",
        host_name=data.host_name,
        livekit_room_name=room_name,
    )
    db.add(meeting)
    await db.flush()

    # Create host participant (auto-approved)
    host = Participant(
        id=uuid.uuid4(),
        meeting_id=meeting.id,
        display_name=data.host_name,
        livekit_identity=data.host_name,
        is_host=True,
        is_approved=True,
    )
    db.add(host)
    meeting.host_participant_id = host.id
    await db.flush()

    # Ensure recording directory
    recording_manager.ensure_meeting_directory(str(meeting.id))

    # Create LiveKit room (best-effort)
    try:
        await livekit_service.create_room(room_name, meeting.max_participants)
    except Exception as exc:
        logger.warning("Could not pre-create LiveKit room: %s", exc)

    logger.info("Created meeting '%s' (code=%s)", meeting.title, code)
    return await _meeting_to_response(meeting, db)


@router.get("", response_model=MeetingListResponse)
async def list_meetings(
    status: str | None = Query(None, description="Filter by status"),
    search: str | None = Query(None, description="Search by title"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List meetings with optional status filter and title search."""
    query = select(Meeting)

    if status:
        query = query.where(Meeting.status == status)
    if search:
        query = query.where(Meeting.title.ilike(f"%{search}%"))

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.order_by(Meeting.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    meetings = result.scalars().all()

    responses = [await _meeting_to_response(m, db) for m in meetings]

    return MeetingListResponse(
        meetings=responses,
        total=total,
        page=(offset // limit) + 1,
        per_page=limit,
    )


@router.get("/code/{code}", response_model=MeetingResponse)
async def get_meeting_by_code(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """Look up a meeting by its shareable code."""
    result = await db.execute(select(Meeting).where(Meeting.code == code))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return await _meeting_to_response(meeting, db)


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single meeting by ID with extended metadata."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return await _meeting_to_response(meeting, db)


@router.post("/{meeting_id}/join")
async def join_meeting(
    meeting_id: uuid.UUID,
    data: JoinRequest,
    db: AsyncSession = Depends(get_db),
):
    """Request to join a meeting.

    If the requester name matches the host, auto-approve and return a
    LiveKit token immediately. Otherwise, the participant is placed
    in 'waiting' status for host approval.
    """
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.status in ("processing", "completed", "failed"):
        raise HTTPException(status_code=400, detail="Meeting has already ended")

    # Check if this is the host returning
    is_host = data.display_name.lower() == meeting.host_name.lower()

    if is_host:
        # Find existing host participant
        host_result = await db.execute(
            select(Participant).where(
                Participant.meeting_id == meeting_id,
                Participant.is_host == True,  # noqa: E712
            )
        )
        host = host_result.scalar_one_or_none()
        if host:
            host.is_active = True
            host.joined_at = datetime.utcnow()
            await db.flush()

            token = await livekit_service.generate_token(
                room_name=meeting.livekit_room_name,
                participant_name=data.display_name,
                is_host=True,
            )
            return JoinResponse(
                token=token,
                room_id=meeting.livekit_room_name,
                livekit_url=settings.LIVEKIT_URL,
                participant_id=host.id,
            )

    # Regular participant — create and wait for approval
    participant = Participant(
        id=uuid.uuid4(),
        meeting_id=meeting_id,
        display_name=data.display_name,
        livekit_identity=data.display_name,
        is_host=False,
        is_approved=False,
    )
    db.add(participant)
    await db.flush()

    logger.info("Participant '%s' waiting for approval in meeting %s", data.display_name, meeting_id)
    return {
        "participant_id": str(participant.id),
        "status": "waiting",
        "message": "Waiting for host approval",
    }


@router.post("/{meeting_id}/approve/{participant_id}")
async def approve_participant(
    meeting_id: uuid.UUID,
    participant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Host approves a waiting participant.

    Generates a LiveKit token and starts individual audio track egress
    for speaker attribution.
    """
    result = await db.execute(
        select(Participant).where(
            Participant.id == participant_id,
            Participant.meeting_id == meeting_id,
        )
    )
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    if participant.is_approved:
        raise HTTPException(status_code=400, detail="Participant already approved")

    # Fetch meeting for room name
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = meeting_result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Approve
    participant.is_approved = True
    participant.joined_at = datetime.utcnow()
    await db.flush()

    # Generate LiveKit token
    token = await livekit_service.generate_token(
        room_name=meeting.livekit_room_name,
        participant_name=participant.display_name,
        is_host=False,
    )

    # Start individual audio track egress (best-effort, may fail if not yet connected)
    try:
        await livekit_service.start_track_egress(
            room_name=meeting.livekit_room_name,
            participant_identity=participant.display_name,
            meeting_id=str(meeting_id),
        )
    except Exception as exc:
        logger.warning("Could not start track egress for %s: %s", participant.display_name, exc)

    logger.info("Approved participant '%s' in meeting %s", participant.display_name, meeting_id)
    return JoinResponse(
        token=token,
        room_id=meeting.livekit_room_name,
        livekit_url=settings.LIVEKIT_URL,
        participant_id=participant.id,
    )


@router.post("/{meeting_id}/decline/{participant_id}")
async def decline_participant(
    meeting_id: uuid.UUID,
    participant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Host declines a waiting participant."""
    result = await db.execute(
        select(Participant).where(
            Participant.id == participant_id,
            Participant.meeting_id == meeting_id,
        )
    )
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    participant.is_approved = False
    participant.is_active = False
    await db.flush()

    logger.info("Declined participant '%s' in meeting %s", participant.display_name, meeting_id)
    return {"status": "declined", "participant_id": str(participant_id)}


@router.post("/{meeting_id}/start")
async def start_meeting(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Start the meeting — sets status to 'active' and begins composite recording."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.status == "active":
        raise HTTPException(status_code=400, detail="Meeting already active")

    meeting.status = "active"
    meeting.started_at = datetime.utcnow()
    await db.flush()

    # Start composite room egress (auto-record)
    egress_id = None
    try:
        egress_id = await livekit_service.start_room_composite_egress(
            room_name=meeting.livekit_room_name,
            meeting_id=str(meeting_id),
        )
    except Exception as exc:
        logger.warning("Could not start composite egress: %s", exc)

    # Create recording record
    if egress_id:
        recording = Recording(
            id=uuid.uuid4(),
            meeting_id=meeting_id,
            egress_id=egress_id,
            file_path=recording_manager.get_recording_path(str(meeting_id), "composite"),
            status="recording",
            started_at=datetime.utcnow(),
        )
        db.add(recording)
        await db.flush()

    logger.info("Started meeting %s", meeting_id)
    return {"status": "active", "meeting_id": str(meeting_id), "egress_id": egress_id}


@router.post("/{meeting_id}/end")
async def end_meeting(
    meeting_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """End the meeting — stops recording and triggers post-processing pipeline."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.status in ("processing", "completed"):
        raise HTTPException(status_code=400, detail="Meeting already ended")

    meeting.status = "processing"
    meeting.ended_at = datetime.utcnow()

    # Calculate duration
    if meeting.started_at:
        duration = (meeting.ended_at - meeting.started_at).total_seconds()
    else:
        duration = 0

    await db.flush()

    # Stop all egress processes (best-effort)
    try:
        egress_list = await livekit_service.list_egress(meeting.livekit_room_name)
        for egress in egress_list:
            try:
                eid = egress.egress_id if hasattr(egress, 'egress_id') else egress.get('egress_id')
                if eid:
                    await livekit_service.stop_egress(eid)
            except Exception as exc:
                logger.warning("Failed to stop egress: %s", exc)
    except Exception as exc:
        logger.warning("Failed to list/stop egress: %s", exc)

    # Trigger post-processing as background task
    background_tasks.add_task(post_processing.process_meeting, str(meeting_id))

    logger.info("Ended meeting %s (duration=%.0fs), starting post-processing", meeting_id, duration)
    return {
        "status": "processing",
        "meeting_id": str(meeting_id),
        "duration": duration,
    }


@router.get("/{meeting_id}/participants", response_model=list[ParticipantResponse])
async def list_participants(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """List all participants in a meeting with their status and join/leave times."""
    # Verify meeting exists
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Meeting not found")

    result = await db.execute(
        select(Participant)
        .where(Participant.meeting_id == meeting_id)
        .order_by(Participant.created_at)
    )
    participants = result.scalars().all()
    return [ParticipantResponse.model_validate(p) for p in participants]


@router.delete("/{meeting_id}", status_code=204)
async def delete_meeting(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a meeting and all associated data (cascade)."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    await db.delete(meeting)
    await db.flush()

    # Clean up storage files (best-effort)
    try:
        import shutil
        from pathlib import Path
        rec_dir = Path(settings.STORAGE_PATH) / "recordings" / str(meeting_id)
        if rec_dir.exists():
            shutil.rmtree(rec_dir, ignore_errors=True)
    except Exception:
        pass

    logger.info("Deleted meeting %s", meeting_id)
    return None

