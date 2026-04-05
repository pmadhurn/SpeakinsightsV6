"""
SpeakInsights v3 — LLM Settings Routes
Get and update the active LLM provider (Ollama vs OpenRouter) at runtime.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.llm_provider import llm_provider
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class LLMSettingsResponse(BaseModel):
    active_provider: str
    ollama: dict
    openrouter: dict


class UpdateLLMProviderRequest(BaseModel):
    provider: str  # "ollama" or "openrouter"
    openrouter_model: Optional[str] = None


# ---------------------------------------------------------------------------
# GET / — get current LLM settings
# ---------------------------------------------------------------------------

@router.get("", response_model=LLMSettingsResponse)
@router.get("/", response_model=LLMSettingsResponse)
async def get_llm_settings():
    """Get the current LLM provider configuration."""
    return llm_provider.get_provider_info()


# ---------------------------------------------------------------------------
# PUT /provider — switch LLM provider
# ---------------------------------------------------------------------------

@router.put("/provider")
async def update_llm_provider(data: UpdateLLMProviderRequest):
    """Switch the active LLM provider between Ollama and OpenRouter."""
    if data.provider not in ("ollama", "openrouter"):
        raise HTTPException(
            status_code=400,
            detail="Invalid provider. Use 'ollama' or 'openrouter'.",
        )

    if data.provider == "openrouter" and not settings.OPENROUTER_API_KEY:
        raise HTTPException(
            status_code=400,
            detail="OpenRouter API key is not configured. Set OPENROUTER_API_KEY in your .env file.",
        )

    llm_provider.active_provider = data.provider

    if data.openrouter_model and data.provider == "openrouter":
        # Dynamically update the OpenRouter model
        from app.core.openrouter_client import openrouter_client
        if openrouter_client:
            openrouter_client._default_model = data.openrouter_model

    logger.info("LLM provider switched to: %s", data.provider)
    return {
        "status": "success",
        "active_provider": llm_provider.active_provider,
        "message": f"Switched to {data.provider}",
    }


# ---------------------------------------------------------------------------
# GET /openrouter/models — list popular OpenRouter models
# ---------------------------------------------------------------------------

@router.get("/openrouter/models")
async def list_openrouter_models():
    """Return a curated list of popular free and paid OpenRouter models."""
    models = [
        {
            "id": "minimax/minimax-m2.5:free",
            "name": "MiniMax M2.5 (Free)",
            "category": "free",
            "description": "Free reasoning model with good performance",
        },
        {
            "id": "google/gemini-2.0-flash-exp:free",
            "name": "Gemini 2.0 Flash (Free)",
            "category": "free",
            "description": "Google's fast experimental model",
        },
        {
            "id": "deepseek/deepseek-chat-v3-0324:free",
            "name": "DeepSeek V3 (Free)",
            "category": "free",
            "description": "DeepSeek's latest chat model",
        },
        {
            "id": "meta-llama/llama-4-maverick:free",
            "name": "Llama 4 Maverick (Free)",
            "category": "free",
            "description": "Meta's latest open model",
        },
        {
            "id": "qwen/qwen3-235b-a22b:free",
            "name": "Qwen3 235B (Free)",
            "category": "free",
            "description": "Alibaba's large MoE model",
        },
        {
            "id": "openai/gpt-4o-mini",
            "name": "GPT-4o Mini",
            "category": "paid",
            "description": "OpenAI's efficient model",
        },
        {
            "id": "anthropic/claude-3.5-sonnet",
            "name": "Claude 3.5 Sonnet",
            "category": "paid",
            "description": "Anthropic's best model for coding and analysis",
        },
        {
            "id": "google/gemini-pro-1.5",
            "name": "Gemini Pro 1.5",
            "category": "paid",
            "description": "Google's powerful multimodal model",
        },
    ]
    return {"models": models}
