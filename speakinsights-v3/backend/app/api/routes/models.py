"""
SpeakInsights v3 — Ollama Model Management Routes
List, pull, delete, and inspect Ollama models from the frontend.
"""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.core.llm_provider import llm_provider
from app.schemas.models import (
    ModelPullRequest,
    OllamaModelInfo,
    OllamaModelListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# GET / — list installed models (accept both /models and /models/)
# ---------------------------------------------------------------------------

@router.get("", response_model=OllamaModelListResponse)
@router.get("/", response_model=OllamaModelListResponse)
async def list_models():
    """List all installed Ollama models with name, size, family, and quantization."""
    try:
        raw_models = await llm_provider.list_models()
    except Exception as exc:
        logger.error("Failed to list models: %s", exc)
        raise HTTPException(status_code=502, detail=f"Ollama service error: {exc}")

    models = []
    for m in raw_models:
        modified = None
        if m.get("modified_at"):
            try:
                modified = datetime.fromisoformat(
                    m["modified_at"].replace("Z", "+00:00")
                )
            except (ValueError, TypeError):
                pass

        models.append(OllamaModelInfo(
            name=m.get("name", ""),
            size=m.get("size"),
            digest=m.get("digest"),
            modified_at=modified,
            details=m.get("details"),
        ))

    return OllamaModelListResponse(models=models)


# ---------------------------------------------------------------------------
# POST /pull — pull (download) a new model with streaming progress
# ---------------------------------------------------------------------------

@router.post("/pull")
async def pull_model(data: ModelPullRequest):
    """Pull a new Ollama model, streaming download progress via SSE.

    This is a long-running operation — progress is streamed to the
    frontend as Server-Sent Events with download percentage and status.
    """
    logger.info("Pulling model: %s", data.name)

    async def progress_generator():
        try:
            async for update in llm_provider.pull_model(data.name):
                status = update.get("status", "")
                total = update.get("total", 0)
                completed = update.get("completed", 0)
                percent = (completed / total * 100) if total > 0 else None

                event = {
                    "status": status,
                    "digest": update.get("digest"),
                    "total": total,
                    "completed": completed,
                    "percent": round(percent, 1) if percent is not None else None,
                }
                yield f"data: {json.dumps(event)}\n\n"

            yield f"data: {json.dumps({'status': 'success', 'message': f'Model {data.name} pulled successfully'})}\n\n"
        except Exception as exc:
            logger.error("Model pull failed: %s", exc)
            yield f"data: {json.dumps({'status': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        progress_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# DELETE /{model_name} — delete a model
# ---------------------------------------------------------------------------

@router.delete("/{model_name:path}")
async def delete_model(model_name: str):
    """Delete an installed Ollama model."""
    try:
        await llm_provider.delete_model(model_name)
    except Exception as exc:
        logger.error("Failed to delete model %s: %s", model_name, exc)
        raise HTTPException(status_code=502, detail=f"Failed to delete model: {exc}")

    logger.info("Deleted model: %s", model_name)
    return {"status": "deleted", "model": model_name}


# ---------------------------------------------------------------------------
# GET /status/running — show currently loaded/running models
# (must be defined BEFORE the catch-all /{model_name:path})
# ---------------------------------------------------------------------------

@router.get("/status/running")
async def get_running_models():
    """Show currently loaded/running models in Ollama."""
    try:
        import httpx
        from app.core.ollama_client import ollama_client
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{ollama_client._base_url}/api/ps")
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.error("Failed to get running models: %s", exc)
        raise HTTPException(status_code=502, detail=f"Ollama service error: {exc}")


# ---------------------------------------------------------------------------
# GET /{model_name} — get model info (catch-all, MUST be last)
# ---------------------------------------------------------------------------

@router.get("/{model_name:path}")
async def get_model_info(model_name: str):
    """Get detailed information about a specific Ollama model."""
    try:
        info = await llm_provider.model_info(model_name)
    except Exception as exc:
        logger.error("Failed to get info for model %s: %s", model_name, exc)
        raise HTTPException(status_code=502, detail=f"Failed to get model info: {exc}")

    return info

