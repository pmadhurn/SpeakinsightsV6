"""
SpeakInsights v3 — Meeting Routes
Full CRUD + join/approve/decline/start/end workflows.
"""

import asyncio
import logging
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings
from app.core.livekit_service import livekit_service
from app.core.post_processing import post_processing
from app.core.recording_manager import recording_manager
from app.models.meeting import Meeting
from app.models.participant import Participant
from app.models.recording import IndividualRecording, Recording
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

async def _generate_code(db: AsyncSession) -> str:
    """Generate a unique meeting code like 'si-a1b2c3d4', retrying on collision."""
    for _ in range(10):
        code = f"si-{secrets.token_hex(4)}"
        result = await db.execute(select(Meeting).where(Meeting.code == code))
        if not result.scalar_one_or_none():
            return code
    raise RuntimeError("Failed to generate a unique meeting code after 10 attempts")


def _get_livekit_external_url(request: Request) -> str:
    """Return the LiveKit WebSocket URL for the frontend to connect to.

    If LIVEKIT_EXTERNAL_URL is a full URL (e.g. wss://...livekit.cloud),
    use it directly — this is the LiveKit Cloud case.
    If it's a relative path (e.g. /livekit-ws/), construct a full URL
    from the incoming request's domain for self-hosted setups.
    """
    external = settings.LIVEKIT_EXTERNAL_URL
    if external and external.startswith(("ws://", "wss://", "http://", "https://")):
        return external
    # Self-hosted fallback: construct from request domain
    proto = request.headers.get("x-forwarded-proto", "http")
    ws_proto = "wss" if proto == "https" else "ws"
    host = request.headers.get("host", "localhost")
    path = external or "/livekit-ws/"
    return f"{ws_proto}://{host}{path}"


async def _meeting_to_response(meeting: Meeting, db: AsyncSession) -> MeetingResponse:
    """Convert a Meeting ORM object to a MeetingResponse, including participant count."""
    count_result = await db.execute(
        select(func.count(Participant.id)).where(Participant.meeting_id == meeting.id)
    )
    participant_count = count_result.scalar() or 0

    # Compute duration from timestamps
    duration = None
    if meeting.started_at and meeting.ended_at:
        duration = (meeting.ended_at - meeting.started_at).total_seconds()

    # Check if recording files exist on disk
    disk_recordings = recording_manager.list_meeting_recordings(str(meeting.id))
    has_recording = len(disk_recordings) > 0

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
        duration=duration,
        has_recording=has_recording,
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
    code = await _generate_code(db)
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
    limit: int = Query(100, ge=1, le=500),
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
    request: Request,
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
            host.joined_at = datetime.now(timezone.utc)
            await db.flush()

            token = await livekit_service.generate_token(
                room_name=meeting.livekit_room_name,
                participant_name=data.display_name,
                is_host=True,
            )
            return JoinResponse(
                token=token,
                room_id=meeting.livekit_room_name,
                livekit_url=_get_livekit_external_url(request),
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
    request: Request,
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
    participant.joined_at = datetime.now(timezone.utc)
    await db.flush()

    # Generate LiveKit token
    token = await livekit_service.generate_token(
        room_name=meeting.livekit_room_name,
        participant_name=participant.display_name,
        is_host=False,
    )

    # Start track-composite egress (audio+video in one MP4) for review playback
    composite_egress_id = None
    try:
        composite_egress_id = await livekit_service.start_track_composite_egress(
            room_name=meeting.livekit_room_name,
            participant_identity=participant.display_name,
            meeting_id=str(meeting_id),
        )
    except Exception as exc:
        logger.warning("Could not start track composite egress for %s: %s", participant.display_name, exc)

    # Start individual audio track egress (best-effort, for transcription)
    audio_egress_id = None
    try:
        audio_egress_id = await livekit_service.start_track_egress(
            room_name=meeting.livekit_room_name,
            participant_identity=participant.display_name,
            meeting_id=str(meeting_id),
        )
    except Exception as exc:
        logger.warning("Could not start audio track egress for %s: %s", participant.display_name, exc)

    # Create IndividualRecording DB record for post-processing transcription
    individual_rec = IndividualRecording(
        id=uuid.uuid4(),
        meeting_id=meeting_id,
        participant_id=participant.id,
        speaker_name=participant.display_name,
        egress_id=composite_egress_id or audio_egress_id,
        file_path=recording_manager.get_individual_track_path(str(meeting_id), participant.display_name),
        status="recording" if (composite_egress_id or audio_egress_id) else "pending",
    )
    db.add(individual_rec)
    await db.flush()

    logger.info("Approved participant '%s' in meeting %s", participant.display_name, meeting_id)
    return JoinResponse(
        token=token,
        room_id=meeting.livekit_room_name,
        livekit_url=_get_livekit_external_url(request),
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


@router.post("/{meeting_id}/kick/{participant_identity}")
async def kick_participant(
    meeting_id: uuid.UUID,
    participant_identity: str,
    db: AsyncSession = Depends(get_db),
):
    """Host kicks a participant from the active LiveKit room."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    room_name = meeting.livekit_room_name
    if not room_name:
        raise HTTPException(status_code=400, detail="Meeting has no active room")

    try:
        await livekit_service.remove_participant(room_name, participant_identity)
        logger.info("Kicked participant '%s' from room %s", participant_identity, room_name)
        return {"status": "kicked", "identity": participant_identity}
    except Exception as exc:
        logger.error("Failed to kick participant '%s': %s", participant_identity, exc)
        raise HTTPException(status_code=500, detail=f"Failed to kick participant: {exc}")

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
    meeting.started_at = datetime.now(timezone.utc)
    await db.flush()

    # Start composite room egress (auto-record) — this often fails with
    # "Start signal not received" on self-hosted setups, so we also start
    # a track-composite egress below as a reliable fallback.
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
            started_at=datetime.now(timezone.utc),
        )
        db.add(recording)
        await db.flush()

    # Start track-composite egress for the host (audio+video combined into one MP4).
    # This is the reliable recording method that produces playable video with audio.
    host_result = await db.execute(
        select(Participant).where(
            Participant.meeting_id == meeting_id,
            Participant.is_host == True,
        )
    )
    host = host_result.scalar_one_or_none()
    if host:
        # Track composite egress — audio+video in one file for review playback
        host_composite_egress_id = None
        try:
            host_composite_egress_id = await livekit_service.start_track_composite_egress(
                room_name=meeting.livekit_room_name,
                participant_identity=host.display_name,
                meeting_id=str(meeting_id),
            )
        except Exception as exc:
            logger.warning("Could not start track composite egress for host %s: %s", host.display_name, exc)

        # Also start individual audio-only track egress for transcription
        host_audio_egress_id = None
        try:
            host_audio_egress_id = await livekit_service.start_track_egress(
                room_name=meeting.livekit_room_name,
                participant_identity=host.display_name,
                meeting_id=str(meeting_id),
            )
        except Exception as exc:
            logger.warning("Could not start audio track egress for host %s: %s", host.display_name, exc)

        # Create IndividualRecording for the host
        host_rec = IndividualRecording(
            id=uuid.uuid4(),
            meeting_id=meeting_id,
            participant_id=host.id,
            speaker_name=host.display_name,
            egress_id=host_composite_egress_id or host_audio_egress_id,
            file_path=recording_manager.get_individual_track_path(str(meeting_id), host.display_name),
            status="recording" if (host_composite_egress_id or host_audio_egress_id) else "pending",
        )
        db.add(host_rec)
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
    meeting.ended_at = datetime.now(timezone.utc)

    # Calculate duration
    if meeting.started_at:
        duration = (meeting.ended_at - meeting.started_at).total_seconds()
    else:
        duration = 0

    await db.flush()

    # Stop all egress processes and collect their IDs for downloading
    egress_ids: list[str] = []
    try:
        egress_list = await livekit_service.list_egress(meeting.livekit_room_name)
        logger.info("Found %d egress processes for room %s", len(egress_list), meeting.livekit_room_name)
        for egress in egress_list:
            eid = egress.egress_id if hasattr(egress, 'egress_id') else egress.get('egress_id')
            if eid:
                # Always collect the egress ID for downloading, even if stop fails
                egress_ids.append(eid)
                try:
                    await livekit_service.stop_egress(eid)
                except Exception as exc:
                    logger.warning("Failed to stop egress %s (will still try to download): %s", eid, exc)
    except Exception as exc:
        logger.warning("Failed to list/stop egress: %s", exc)

    logger.info("Collected %d egress IDs for post-processing download: %s", len(egress_ids), egress_ids)

    # Trigger post-processing as background task (with egress IDs for download)
    background_tasks.add_task(
        post_processing.process_meeting, str(meeting_id), egress_ids
    )

    logger.info("Ended meeting %s (duration=%.0fs), starting post-processing", meeting_id, duration)
    return {
        "status": "processing",
        "meeting_id": str(meeting_id),
        "duration": duration,
    }


@router.post("/{meeting_id}/retranscribe")
async def retranscribe_meeting(
    meeting_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Re-transcribe a meeting using stored recordings.

    Clears existing transcription segments, summaries, tasks, embeddings,
    and calendar exports, then re-runs the full post-processing pipeline
    on the recordings that are still on disk.
    """
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.status == "active":
        raise HTTPException(status_code=400, detail="Cannot re-transcribe an active meeting")

    # Check that recordings exist on disk
    disk_files = recording_manager.list_meeting_recordings(str(meeting_id))
    if not disk_files:
        raise HTTPException(
            status_code=400,
            detail="No recordings found on disk for this meeting",
        )

    # Set status to processing
    meeting.status = "processing"
    await db.flush()

    # Clear existing post-processing artefacts so the pipeline creates fresh ones
    from app.models.transcription import TranscriptionSegment
    from app.models.summary import Summary
    from app.models.task import Task
    from app.models.embedding import TranscriptEmbedding
    from app.models.calendar_export import CalendarExport

    await db.execute(
        delete(TranscriptionSegment).where(TranscriptionSegment.meeting_id == meeting_id)
    )
    await db.execute(
        delete(Summary).where(Summary.meeting_id == meeting_id)
    )
    await db.execute(
        delete(Task).where(Task.meeting_id == meeting_id)
    )
    await db.execute(
        delete(TranscriptEmbedding).where(TranscriptEmbedding.meeting_id == meeting_id)
    )
    await db.execute(
        delete(CalendarExport).where(CalendarExport.meeting_id == meeting_id)
    )

    # Reset individual recording transcription statuses
    ind_result = await db.execute(
        select(IndividualRecording).where(IndividualRecording.meeting_id == meeting_id)
    )
    for rec in ind_result.scalars().all():
        rec.transcription_status = "pending"

    await db.flush()

    logger.info(
        "Cleared existing transcription data for meeting %s, starting re-transcription",
        meeting_id,
    )

    # Trigger post-processing in background (no egress IDs — recordings are already on disk)
    background_tasks.add_task(post_processing.process_meeting, str(meeting_id))

    return {
        "status": "processing",
        "meeting_id": str(meeting_id),
        "message": "Re-transcription started. Existing data has been cleared.",
        "recording_files": len(disk_files),
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


@router.post("/{meeting_id}/stop-processing")
async def stop_processing(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Force a meeting out of 'processing' status back to 'completed'.

    Use this when post-processing is stuck or the user wants to skip it.
    """
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.status != "processing":
        raise HTTPException(status_code=400, detail="Meeting is not currently processing")

    meeting.status = "completed"
    if not meeting.ended_at:
        meeting.ended_at = datetime.now(timezone.utc)
    await db.flush()

    logger.info("Force-stopped processing for meeting %s", meeting_id)
    return {"status": "completed", "meeting_id": str(meeting_id)}
