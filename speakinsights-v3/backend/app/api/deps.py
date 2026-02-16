"""
SpeakInsights v3 — Common API Dependencies
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db as _get_db
from app.config import Settings, get_settings as _get_settings


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yields an async database session."""
    async for session in _get_db():
        yield session


def get_settings() -> Settings:
    """Returns the cached settings singleton."""
    return _get_settings()
