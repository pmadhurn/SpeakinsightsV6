"""
SpeakInsights v3 — Health Check Route
GET / → returns service health status for db, redis, livekit, whisperx, ollama.
"""

import logging

import httpx
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


async def _check_db(db: AsyncSession) -> str:
    """Check database connectivity."""
    try:
        await db.execute(text("SELECT 1"))
        return "connected"
    except Exception as exc:
        logger.warning("DB health check failed: %s", exc)
        return "disconnected"


async def _check_redis() -> str:
    """Check Redis connectivity."""
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await r.ping()
        await r.aclose()
        return "connected"
    except Exception as exc:
        logger.warning("Redis health check failed: %s", exc)
        return "disconnected"


async def _check_livekit() -> str:
    """Check LiveKit connectivity via HTTP health endpoint."""
    try:
        # LiveKit HTTP API is on port 7880 by default
        url = settings.LIVEKIT_URL.replace("ws://", "http://").replace("wss://", "https://")
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return "connected"
            return "error"
    except Exception as exc:
        logger.warning("LiveKit health check failed: %s", exc)
        return "disconnected"


async def _check_whisperx() -> str:
    """Check WhisperX service health."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.WHISPERX_URL}/health")
            if resp.status_code == 200:
                return "connected"
            return "error"
    except Exception as exc:
        logger.warning("WhisperX health check failed: %s", exc)
        return "disconnected"


async def _check_ollama() -> str:
    """Check Ollama connectivity."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.OLLAMA_URL}/api/tags")
            if resp.status_code == 200:
                return "connected"
            return "error"
    except Exception as exc:
        logger.warning("Ollama health check failed: %s", exc)
        return "disconnected"


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check endpoint — reports status of all backend services."""
    db_status = await _check_db(db)
    redis_status = await _check_redis()
    livekit_status = await _check_livekit()
    whisperx_status = await _check_whisperx()
    ollama_status = await _check_ollama()

    services = {
        "db": db_status,
        "redis": redis_status,
        "livekit": livekit_status,
        "whisperx": whisperx_status,
        "ollama": ollama_status,
    }

    all_ok = all(s == "connected" for s in services.values())

    return {
        "status": "ok" if all_ok else "degraded",
        "version": "3.0.0",
        "services": services,
    }

