"""
SpeakInsights v3 — LLM Provider Abstraction

Provides a unified interface that delegates to either OllamaClient or
OpenRouterClient based on a runtime-switchable setting. Embeddings always
go through Ollama (since OpenRouter doesn't offer embedding endpoints).

Usage:
    from app.core.llm_provider import llm_provider
    result = await llm_provider.generate(prompt)
    embedding = await llm_provider.generate_embedding(text)  # always Ollama
"""

import json
import logging
from typing import Any, AsyncGenerator, Optional

from app.config import settings
from app.core.ollama_client import ollama_client

logger = logging.getLogger(__name__)


class LLMProvider:
    """Unified LLM provider that can switch between Ollama and OpenRouter."""

    def __init__(self) -> None:
        self._active_provider: str = settings.LLM_PROVIDER  # "ollama" or "openrouter"
        logger.info("LLMProvider initialised (active=%s)", self._active_provider)

    @property
    def active_provider(self) -> str:
        return self._active_provider

    @active_provider.setter
    def active_provider(self, provider: str) -> None:
        if provider not in ("ollama", "openrouter"):
            raise ValueError(f"Invalid LLM provider: {provider}. Use 'ollama' or 'openrouter'.")
        self._active_provider = provider
        logger.info("LLM provider switched to: %s", provider)

    def _get_client(self) -> Any:
        """Get the active LLM client instance."""
        if self._active_provider == "openrouter":
            from app.core.openrouter_client import openrouter_client
            if openrouter_client is None:
                logger.warning(
                    "OpenRouter is selected but not configured (missing API key). "
                    "Falling back to Ollama."
                )
                return ollama_client
            return openrouter_client
        return ollama_client

    # ------------------------------------------------------------------
    # Delegated LLM methods
    # ------------------------------------------------------------------

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        format: str = "json",
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> dict[str, Any]:
        """Generate text via the active provider."""
        client = self._get_client()
        return await client.generate(prompt, model=model, format=format,
                                      temperature=temperature, max_tokens=max_tokens)

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        stream: bool = False,
    ) -> dict[str, Any]:
        """Chat completion via the active provider."""
        client = self._get_client()
        return await client.chat(messages, model=model, stream=stream)

    async def chat_stream(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Streaming chat completion via the active provider."""
        client = self._get_client()
        async for chunk in client.chat_stream(messages, model=model):
            yield chunk

    async def summarize_transcript(
        self,
        transcript_text: str,
        meeting_title: str,
    ) -> dict[str, Any]:
        """Summarise a transcript via the active provider."""
        client = self._get_client()
        return await client.summarize_transcript(transcript_text, meeting_title)

    async def extract_tasks(self, transcript_text: str) -> list[dict[str, Any]]:
        """Extract tasks via the active provider."""
        client = self._get_client()
        return await client.extract_tasks(transcript_text)

    async def analyze_sentiment(
        self,
        transcript_text: str,
        speaker_names: list[str],
    ) -> dict[str, Any]:
        """Deep sentiment analysis via the active provider."""
        client = self._get_client()
        return await client.analyze_sentiment(transcript_text, speaker_names)

    # ------------------------------------------------------------------
    # Embedding methods — ALWAYS use Ollama
    # ------------------------------------------------------------------

    async def generate_embedding(self, text: str) -> list[float]:
        """Generate embedding vector (always via Ollama)."""
        return await ollama_client.generate_embedding(text)

    async def generate_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """Batch embed texts (always via Ollama)."""
        return await ollama_client.generate_embeddings_batch(texts)

    # ------------------------------------------------------------------
    # Ollama-specific model management (pass-through)
    # ------------------------------------------------------------------

    async def list_models(self) -> list[dict[str, Any]]:
        """List Ollama models."""
        return await ollama_client.list_models()

    async def pull_model(self, model_name: str) -> AsyncGenerator[dict[str, Any], None]:
        """Pull an Ollama model."""
        async for update in ollama_client.pull_model(model_name):
            yield update

    async def delete_model(self, model_name: str) -> bool:
        """Delete an Ollama model."""
        return await ollama_client.delete_model(model_name)

    async def model_info(self, model_name: str) -> dict[str, Any]:
        """Get Ollama model info."""
        return await ollama_client.model_info(model_name)

    # ------------------------------------------------------------------
    # Provider info
    # ------------------------------------------------------------------

    def get_provider_info(self) -> dict[str, Any]:
        """Return info about the active LLM provider configuration."""
        info: dict[str, Any] = {
            "active_provider": self._active_provider,
            "ollama": {
                "url": settings.OLLAMA_URL,
                "model": settings.OLLAMA_MODEL,
                "embedding_model": settings.EMBEDDING_MODEL,
            },
        }
        if settings.OPENROUTER_API_KEY:
            info["openrouter"] = {
                "model": settings.OPENROUTER_MODEL,
                "reasoning": settings.OPENROUTER_REASONING,
                "configured": True,
            }
        else:
            info["openrouter"] = {
                "configured": False,
            }
        return info


# Singleton
llm_provider = LLMProvider()
