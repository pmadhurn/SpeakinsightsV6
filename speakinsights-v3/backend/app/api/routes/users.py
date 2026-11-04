"""
SpeakInsights v3 — User Routes
Per-account profile and data summary for signed-in Clerk users.
All data is scoped to meetings hosted by the current user.

Guests (no Clerk token) receive 401 — their data stays in the public
shared space they can already see through the existing public endpoints.
"""

import logging
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import get_current_user
from app.models.meeting import Meeting
from app.models.participant import Participant
from app.models.transcription import TranscriptionSegment
from app.models.chat import ChatMessage
from app.models.task import Task
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/me")
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Signed-in profile plus everything the account owns.

    Returns profile (clerk-linked), aggregate stats, and the 5 most
    recent hosted meetings. Every query filters by host_user_id.
    """
    meetings_result = await db.execute(
        select(Meeting)
        .where(Meeting.host_user_id == user.id)
        .order_by(Meeting.created_at.desc())
    )
    meetings = meetings_result.scalars().all()
    meeting_ids = [m.id for m in meetings]

    total_meetings = len(meetings)
    active_meetings = sum(1 for m in meetings if m.status == "active")
    completed_meetings = sum(1 for m in meetings if m.status == "completed")

    total_duration = 0.0
    for m in meetings:
        if m.started_at and m.ended_at:
            total_duration += (m.ended_at - m.started_at).total_seconds()

    if meeting_ids:
        participants_count = (
            await db.execute(
                select(func.count(Participant.id)).where(
                    Participant.meeting_id.in_(meeting_ids)
                )
            )
        ).scalar() or 0

        segments_count = (
            await db.execute(
                select(func.count(TranscriptionSegment.id)).where(
                    TranscriptionSegment.meeting_id.in_(meeting_ids)
                )
            )
        ).scalar() or 0

        chat_count = (
            await db.execute(
                select(func.count(ChatMessage.id)).where(
                    ChatMessage.meeting_id.in_(meeting_ids)
                )
            )
        ).scalar() or 0

        tasks_total = (
            await db.execute(select(func.count(Task.id)).where(Task.meeting_id.in_(meeting_ids)))
        ).scalar() or 0

        tasks_completed = (
            await db.execute(
                select(func.count(Task.id)).where(
                    Task.meeting_id.in_(meeting_ids),
                    Task.status == "completed",
                )
            )
        ).scalar() or 0
    else:
        participants_count = segments_count = chat_count = 0
        tasks_total = tasks_completed = 0

    recent = [
        {
            "id": str(m.id),
            "title": m.title,
            "status": m.status,
            "code": m.code,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "duration": (
                (m.ended_at - m.started_at).total_seconds()
                if m.started_at and m.ended_at
                else None
            ),
        }
        for m in meetings[:5]
    ]

    return {
        "user": {
            "id": str(user.id),
            "clerk_id": user.clerk_id,
            "email": user.email,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "member_since": user.created_at.isoformat() if user.created_at else None,
        },
        "stats": {
            "meetings_total": total_meetings,
            "meetings_active": active_meetings,
            "meetings_completed": completed_meetings,
            "total_duration_seconds": round(total_duration, 1),
            "participants": participants_count,
            "transcript_segments": segments_count,
            "chat_messages": chat_count,
            "tasks_total": tasks_total,
            "tasks_completed": tasks_completed,
        },
        "recent_meetings": recent,
    }
