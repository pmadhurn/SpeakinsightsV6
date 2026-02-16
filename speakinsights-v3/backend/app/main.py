"""
SpeakInsights v3 — FastAPI Application Entry Point
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db.database import engine, Base

# Import all models so they are registered with SQLAlchemy
import app.models  # noqa: F401

# Import route modules
from app.api.routes import health, meetings, transcriptions, summaries, recordings, calendar, chat, models
from app.websockets.router import ws_router

logger = logging.getLogger("speakinsights")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # Startup
    logger.info("SpeakInsights v3 API starting up...")

    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created/verified.")

    yield

    # Shutdown
    logger.info("SpeakInsights v3 API shutting down...")
    await engine.dispose()


# Create FastAPI application
app = FastAPI(
    title="SpeakInsights v3 API",
    description="Multi-person meeting platform with real-time transcription, AI summarization, and RAG chat.",
    version="3.0.0",
    lifespan=lifespan,
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
    return JSONResponse(status_code=404, content={"detail": "Not found"})


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(meetings.router, prefix="/api/meetings", tags=["Meetings"])
app.include_router(transcriptions.router, prefix="/api/transcriptions", tags=["Transcriptions"])
app.include_router(summaries.router, prefix="/api/summaries", tags=["Summaries"])
app.include_router(recordings.router, prefix="/api/recordings", tags=["Recordings"])
app.include_router(calendar.router, prefix="/api/calendar", tags=["Calendar"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI Chat"])
app.include_router(models.router, prefix="/api/models", tags=["Ollama Models"])

# ---------------------------------------------------------------------------
# WebSocket Routes
# ---------------------------------------------------------------------------
app.include_router(ws_router)

# ---------------------------------------------------------------------------
# Static File Serving (recordings, exports)
# ---------------------------------------------------------------------------
storage_path = settings.STORAGE_PATH
if os.path.isdir(storage_path):
    app.mount("/storage", StaticFiles(directory=storage_path), name="storage")

# ---------------------------------------------------------------------------
# Root health endpoint (for Docker healthcheck)
# ---------------------------------------------------------------------------
@app.get("/health")
async def root_health():
    return {"status": "healthy"}
