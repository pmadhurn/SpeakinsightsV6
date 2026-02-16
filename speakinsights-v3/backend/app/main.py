"""
SpeakInsights v3 — FastAPI Application Entry Point (FINAL)

This is the central wiring file that:
  • Creates the FastAPI app with lifespan management
  • Configures CORS, exception handlers, logging
  • Mounts all REST API routes (8 routers under /api/*)
  • Mounts all WebSocket routes (3 channels under /ws/*)
  • Serves static files from /storage for recordings & exports
  • Runs startup health checks against every backend service
"""

import asyncio
import os
import logging
import sys
from contextlib import asynccontextmanager

import httpx
import redis.asyncio as aioredis
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.config import settings
from app.db.database import engine, Base

# Import all models so SQLAlchemy registers them before create_all
import app.models  # noqa: F401

# Route imports — central __init__ re-exports every router
from app.api.routes import (
    health_router,
    meetings_router,
    transcriptions_router,
    summaries_router,
    recordings_router,
    calendar_router,
    chat_router,
    models_router,
)
from app.websockets.router import ws_router

# ---------------------------------------------------------------------------
# Logging setup — structured, coloured for dev
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("speakinsights")


# ---------------------------------------------------------------------------
# Startup service health checks
# ---------------------------------------------------------------------------
async def _check_service_connectivity() -> None:
    """
    Best-effort connectivity check for every backend dependency.
    Logs each service status; failures are warnings, not fatal.
    """
    results: dict[str, str] = {}

    # PostgreSQL
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        results["PostgreSQL"] = "connected ✓"
    except Exception as exc:
        results["PostgreSQL"] = f"FAILED ({exc})"

    # Redis
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await r.ping()
        await r.aclose()
        results["Redis"] = "connected ✓"
    except Exception as exc:
        results["Redis"] = f"FAILED ({exc})"

    # LiveKit
    try:
        url = settings.LIVEKIT_URL.replace("ws://", "http://").replace("wss://", "https://")
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            results["LiveKit"] = "connected ✓" if resp.status_code == 200 else f"HTTP {resp.status_code}"
    except Exception as exc:
        results["LiveKit"] = f"FAILED ({exc})"

    # WhisperX
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.WHISPERX_URL}/health")
            results["WhisperX"] = "connected ✓" if resp.status_code == 200 else f"HTTP {resp.status_code}"
    except Exception as exc:
        results["WhisperX"] = f"FAILED ({exc})"

    # Ollama
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.OLLAMA_URL}/api/tags")
            results["Ollama"] = "connected ✓" if resp.status_code == 200 else f"HTTP {resp.status_code}"
    except Exception as exc:
        results["Ollama"] = f"FAILED ({exc})"

    # Pretty-print results
    logger.info("─── Service connectivity check ───")
    for name, status in results.items():
        level = logging.INFO if "✓" in status else logging.WARNING
        logger.log(level, "  %-12s  %s", name, status)
    logger.info("──────────────────────────────────")


# ---------------------------------------------------------------------------
# Application lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables, check services. Shutdown: dispose engine."""
    logger.info("╔══════════════════════════════════════════╗")
    logger.info("║   SpeakInsights v3 API — starting up     ║")
    logger.info("╚══════════════════════════════════════════╝")

    # Ensure DB tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created / verified.")

    # Ensure storage directories exist
    for subdir in ("recordings", "exports", "temp"):
        path = os.path.join(settings.STORAGE_PATH, subdir)
        os.makedirs(path, exist_ok=True)
    logger.info("Storage directories verified: %s", settings.STORAGE_PATH)

    # Non-blocking service check (runs as a task so app starts immediately)
    asyncio.create_task(_check_service_connectivity())

    yield  # ── Application runs here ──

    logger.info("SpeakInsights v3 API shutting down …")
    await engine.dispose()
    logger.info("Database engine disposed. Goodbye.")


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SpeakInsights v3 API",
    description=(
        "Multi-person meeting platform with real-time video conferencing, "
        "WhisperX transcription, Ollama AI summarization, RAG chat, "
        "sentiment analysis, and calendar export."
    ),
    version="3.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Exception Handlers
# ---------------------------------------------------------------------------
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """Consistent JSON 404 for missing API routes."""
    return JSONResponse(status_code=404, content={"detail": "Not found"})


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """Log and return JSON 500 for unhandled server errors."""
    logger.error("Internal server error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ---------------------------------------------------------------------------
# REST API Routes
# ---------------------------------------------------------------------------
app.include_router(health_router,          prefix="/api",                tags=["Health"])
app.include_router(meetings_router,        prefix="/api/meetings",       tags=["Meetings"])
app.include_router(transcriptions_router,  prefix="/api/transcriptions", tags=["Transcriptions"])
app.include_router(summaries_router,       prefix="/api/summaries",      tags=["Summaries"])
app.include_router(recordings_router,      prefix="/api/recordings",     tags=["Recordings"])
app.include_router(calendar_router,        prefix="/api/calendar",       tags=["Calendar"])
app.include_router(chat_router,            prefix="/api/chat",           tags=["AI Chat"])
app.include_router(models_router,          prefix="/api/models",         tags=["Ollama Models"])

# ---------------------------------------------------------------------------
# WebSocket Routes (/ws/lobby, /ws/transcript, /ws/meeting)
# ---------------------------------------------------------------------------
app.include_router(ws_router)

# ---------------------------------------------------------------------------
# Static file serving — recordings, exports, temp files
# ---------------------------------------------------------------------------
storage_path = settings.STORAGE_PATH
if os.path.isdir(storage_path):
    app.mount("/storage", StaticFiles(directory=storage_path), name="storage")
    logger.info("Mounted /storage → %s", storage_path)
else:
    logger.warning("Storage path %s does not exist — /storage not mounted", storage_path)


# ---------------------------------------------------------------------------
# Root health endpoint (Docker healthcheck: GET /health → 200)
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def root_health():
    """Lightweight health check for Docker / load-balancer probes."""
    return {"status": "healthy", "version": "3.0.0"}
