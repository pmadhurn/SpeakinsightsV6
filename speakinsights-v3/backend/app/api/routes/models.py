"""
SpeakInsights v3 — Ollama Model Management Routes
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import httpx

from app.config import settings
from app.schemas.models import (
    OllamaModelInfo,
    OllamaModelListResponse,
    ModelPullRequest,
    ModelDeleteRequest,
)

router = APIRouter()


@router.get("/", response_model=OllamaModelListResponse)
async def list_models():
    """List all available Ollama models."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{settings.OLLAMA_URL}/api/tags")
            resp.raise_for_status()
            data = resp.json()

        models = []
        for m in data.get("models", []):
            models.append(
                OllamaModelInfo(
                    name=m.get("name", ""),
                    size=m.get("size"),
                    digest=m.get("digest"),
                    modified_at=m.get("modified_at"),
                    details=m.get("details"),
                )
            )
        return OllamaModelListResponse(models=models)
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Ollama. Is it running?")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pull")
async def pull_model(data: ModelPullRequest):
    """Pull/download an Ollama model. Streams progress."""
    async def stream_pull():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{settings.OLLAMA_URL}/api/pull",
                json={"name": data.name, "stream": True},
            ) as resp:
                async for line in resp.aiter_lines():
                    if line:
                        yield line + "\n"

    try:
        return StreamingResponse(
            stream_pull(),
            media_type="application/x-ndjson",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{model_name}")
async def delete_model(model_name: str):
    """Delete an Ollama model."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(
                f"{settings.OLLAMA_URL}/api/delete",
                json={"name": model_name},
            )
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
            resp.raise_for_status()
        return {"status": "deleted", "model": model_name}
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Ollama")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
