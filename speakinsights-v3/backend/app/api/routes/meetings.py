"""
SpeakInsights v3 — Meeting Routes
"""

import uuid
import string
import random
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api.deps import get_db
from app.models.meeting import Meeting
from app.models.participant import Participant
from app.schemas.meeting import (
    MeetingCreate,
    MeetingResponse,
    MeetingListResponse,
    JoinRequest,
    JoinResponse,
    ParticipantResponse,
)

router = APIRouter()


def generate_meeting_code(length: int = 8) -> str:
    """Generate a random meeting code."""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


@router.post("/", response_model=MeetingResponse, status_code=201)
async def create_meeting(
    data: MeetingCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new meeting."""
    code = generate_meeting_code()
    room_name = f"meeting-{code.lower()}"

    # Create host participant
    host_participant = Participant(
        display_name=data.host_name,
        is_host=True,
        is_approved=True,
    )

    meeting = Meeting(
        title=data.title,
        description=data.description,
        code=code,
        language=data.language,
        host_name=data.host_name,
        livekit_room_name=room_name,
        status="waiting",
    )

    meeting.participants.append(host_participant)
    db.add(meeting)
    await db.flush()

    meeting.host_participant_id = host_participant.id
    await db.flush()

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
        participant_count=1,
    )


@router.get("/", response_model=MeetingListResponse)
async def list_meetings(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all meetings with pagination."""
    query = select(Meeting).order_by(Meeting.created_at.desc())
    if status:
        query = query.where(Meeting.status == status)

    # Count total
    count_query = select(func.count()).select_from(Meeting)
    if status:
        count_query = count_query.where(Meeting.status == status)
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    meetings = result.scalars().all()

    return MeetingListResponse(
        meetings=[
            MeetingResponse(
                id=m.id,
                title=m.title,
                description=m.description,
                code=m.code,
                language=m.language,
                status=m.status,
                host_name=m.host_name,
                max_participants=m.max_participants,
                started_at=m.started_at,
                ended_at=m.ended_at,
                created_at=m.created_at,
                updated_at=m.updated_at,
            )
            for m in meetings
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a meeting by ID."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
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
    )


@router.get("/code/{code}", response_model=MeetingResponse)
async def get_meeting_by_code(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a meeting by its join code."""
    result = await db.execute(select(Meeting).where(Meeting.code == code))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
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
    )


@router.post("/{meeting_id}/join")
async def request_join(
    meeting_id: uuid.UUID,
    data: JoinRequest,
    db: AsyncSession = Depends(get_db),
):
    """Request to join a meeting (goes to lobby)."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.status not in ("waiting", "active"):
        raise HTTPException(status_code=400, detail="Meeting is not accepting participants")

    participant = Participant(
        meeting_id=meeting_id,
        display_name=data.display_name,
        is_host=False,
        is_approved=False,
    )
    db.add(participant)
    await db.flush()

    return {
        "participant_id": str(participant.id),
        "status": "waiting_for_approval",
        "message": "Your request has been sent to the host",
    }


@router.get("/{meeting_id}/participants", response_model=list[ParticipantResponse])
async def get_participants(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all participants for a meeting."""
    result = await db.execute(
        select(Participant).where(Participant.meeting_id == meeting_id)
    )
    participants = result.scalars().all()
    return [ParticipantResponse.model_validate(p) for p in participants]


@router.post("/{meeting_id}/end")
async def end_meeting(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """End a meeting and trigger post-processing."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    meeting.status = "processing"
    meeting.ended_at = datetime.utcnow()
    await db.flush()

    return {"status": "processing", "message": "Meeting ended. Post-processing started."}
