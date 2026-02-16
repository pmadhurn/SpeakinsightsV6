"""
SpeakInsights v3 — Health Check Routes
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.api.deps import get_db
from app.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": "SpeakInsights v3 API",
        "version": "3.0.0",
    }


@router.get("/health/db")
async def health_check_db(db: AsyncSession = Depends(get_db)):
    """Database health check."""
    try:
        result = await db.execute(text("SELECT 1"))
        result.scalar()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}


@router.get("/health/services")
async def health_check_services():
    """Check connectivity to external services."""
    import httpx

    services = {}

    # Check Redis
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL)
        await r.ping()
        services["redis"] = "connected"
        await r.aclose()
    except Exception as e:
        services["redis"] = f"error: {str(e)}"

    # Check Ollama
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.OLLAMA_URL}/api/tags")
            services["ollama"] = "connected" if resp.status_code == 200 else f"error: {resp.status_code}"
    except Exception as e:
        services["ollama"] = f"error: {str(e)}"

    # Check WhisperX
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.WHISPERX_URL}/health")
            services["whisperx"] = "connected" if resp.status_code == 200 else f"error: {resp.status_code}"
    except Exception as e:
        services["whisperx"] = f"error: {str(e)}"

    return {"status": "ok", "services": services}
