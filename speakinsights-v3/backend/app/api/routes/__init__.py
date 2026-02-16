"""
SpeakInsights v3 — API Routes Package
Central import hub for all REST API routers.
main.py imports from here to mount every route group.
"""

from app.api.routes.health import router as health_router
from app.api.routes.meetings import router as meetings_router
from app.api.routes.transcriptions import router as transcriptions_router
from app.api.routes.summaries import router as summaries_router
from app.api.routes.recordings import router as recordings_router
from app.api.routes.calendar import router as calendar_router
from app.api.routes.chat import router as chat_router
from app.api.routes.models import router as models_router

__all__ = [
    "health_router",
    "meetings_router",
    "transcriptions_router",
    "summaries_router",
    "recordings_router",
    "calendar_router",
    "chat_router",
    "models_router",
]

# Route prefix mapping (used by main.py):
# health_router         → /api           (GET /api/health)
# meetings_router       → /api/meetings  (CRUD + join/approve/start/end)
# transcriptions_router → /api/transcriptions (audio chunks, transcript retrieval)
# summaries_router      → /api/summaries (AI summary, tasks, sentiment)
# recordings_router     → /api/recordings (video/audio file serving)
# calendar_router       → /api/calendar  (.ics export)
# chat_router           → /api/chat      (RAG-powered AI chat)
# models_router         → /api/models    (Ollama model management)