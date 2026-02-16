"""
SpeakInsights v3 — Summary Routes
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db
from app.models.summary import Summary
from app.models.task import Task
from app.models.meeting import Meeting
from app.schemas.summary import SummaryResponse, TaskResponse, TaskCreate

router = APIRouter()


@router.get("/{meeting_id}", response_model=list[SummaryResponse])
async def get_summaries(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all summaries for a meeting."""
    result = await db.execute(
        select(Summary).where(Summary.meeting_id == meeting_id)
    )
    summaries = result.scalars().all()
    return [SummaryResponse.model_validate(s) for s in summaries]


@router.get("/{meeting_id}/tasks", response_model=list[TaskResponse])
async def get_tasks(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all tasks for a meeting."""
    result = await db.execute(
        select(Task).where(Task.meeting_id == meeting_id).order_by(Task.created_at)
    )
    tasks = result.scalars().all()
    return [TaskResponse.model_validate(t) for t in tasks]


@router.post("/{meeting_id}/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    meeting_id: uuid.UUID,
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
):
    """Manually create a task for a meeting."""
    # Verify meeting exists
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Meeting not found")

    task = Task(
        meeting_id=meeting_id,
        title=data.title,
        description=data.description,
        assignee=data.assignee,
        due_date=data.due_date,
        priority=data.priority,
    )
    db.add(task)
    await db.flush()

    return TaskResponse.model_validate(task)


@router.patch("/{meeting_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task_status(
    meeting_id: uuid.UUID,
    task_id: uuid.UUID,
    status: str,
    db: AsyncSession = Depends(get_db),
):
    """Update a task's status."""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.meeting_id == meeting_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = status
    await db.flush()
    return TaskResponse.model_validate(task)
