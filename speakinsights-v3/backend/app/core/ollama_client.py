"""
SpeakInsights v3 — Ollama Client
Async client for Ollama LLM: generation, chat, summarisation,
task extraction, sentiment analysis, embeddings, and model management.
"""

import json
import logging
from typing import Any, AsyncGenerator, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class OllamaClient:
    """Async client for the Ollama API (LLM + embeddings + model management)."""

    def __init__(self) -> None:
        self._base_url: str = settings.OLLAMA_URL.rstrip("/")
        self._default_model: str = settings.OLLAMA_MODEL
        self._embedding_model: str = settings.EMBEDDING_MODEL
        logger.info(
            "OllamaClient initialised (url=%s, model=%s, embed=%s)",
            self._base_url,
            self._default_model,
            self._embedding_model,
        )

    # ------------------------------------------------------------------
    # Generic generation
    # ------------------------------------------------------------------

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        format: str = "json",
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> dict[str, Any]:
        """Generic LLM generation call.

        Args:
            prompt: The prompt text.
            model: Model name override (defaults to settings.OLLAMA_MODEL).
            format: Response format – 'json' or '' for plain text.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.

        Returns:
            Dict with keys: response (str), model (str), tokens (int).
        """
        model = model or self._default_model
        try:
            payload: dict[str, Any] = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                },
            }
            if format:
                payload["format"] = format

            async with httpx.AsyncClient(timeout=300.0) as client:
                resp = await client.post(f"{self._base_url}/api/generate", json=payload)
                resp.raise_for_status()

            data = resp.json()
            logger.debug("Ollama generate completed (model=%s)", model)
            return {
                "response": data.get("response", ""),
                "model": data.get("model", model),
                "tokens": data.get("eval_count", 0),
            }
        except Exception as exc:
            logger.error("Ollama generate failed: %s", exc, exc_info=True)
            raise

    # ------------------------------------------------------------------
    # Chat completions
    # ------------------------------------------------------------------

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        stream: bool = False,
    ) -> dict[str, Any]:
        """Chat completion (non-streaming).

        Args:
            messages: List of message dicts [{role, content}].
            model: Model name override.
            stream: If True, delegates to chat_stream.

        Returns:
            Dict with response text and metadata.
        """
        if stream:
            # Collect full streamed response
            chunks: list[str] = []
            async for chunk in self.chat_stream(messages, model):
                chunks.append(chunk)
            return {"response": "".join(chunks), "model": model or self._default_model}

        model = model or self._default_model
        try:
            payload = {
                "model": model,
                "messages": messages,
                "stream": False,
            }
            async with httpx.AsyncClient(timeout=300.0) as client:
                resp = await client.post(f"{self._base_url}/api/chat", json=payload)
                resp.raise_for_status()

            data = resp.json()
            message = data.get("message", {})
            return {
                "response": message.get("content", ""),
                "model": data.get("model", model),
                "tokens": data.get("eval_count", 0),
            }
        except Exception as exc:
            logger.error("Ollama chat failed: %s", exc, exc_info=True)
            raise

    async def chat_stream(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Streaming chat completion — yields text chunks.

        Args:
            messages: List of message dicts.
            model: Model name override.

        Yields:
            Text chunks as they arrive from Ollama.
        """
        model = model or self._default_model
        try:
            payload = {
                "model": model,
                "messages": messages,
                "stream": True,
            }
            async with httpx.AsyncClient(timeout=300.0) as client:
                async with client.stream(
                    "POST", f"{self._base_url}/api/chat", json=payload
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                            content = data.get("message", {}).get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
        except Exception as exc:
            logger.error("Ollama chat_stream failed: %s", exc, exc_info=True)
            raise

    # ------------------------------------------------------------------
    # Domain-specific: summarisation
    # ------------------------------------------------------------------

    async def summarize_transcript(
        self,
        transcript_text: str,
        meeting_title: str,
    ) -> dict[str, Any]:
        """Summarise a meeting transcript.

        Args:
            transcript_text: Full transcript with speaker labels.
            meeting_title: Title of the meeting for context.

        Returns:
            Dict with executive_summary, key_points, decisions_made, follow_ups.
        """
        prompt = f"""You are an expert meeting analyst. Analyse the following meeting transcript and produce a JSON summary.

Meeting Title: {meeting_title}

Transcript:
{transcript_text}

Return a JSON object with exactly these keys:
- "executive_summary": A concise 2-4 sentence overview of the meeting.
- "key_points": An array of the most important discussion points (strings).
- "decisions_made": An array of decisions that were agreed upon (strings).
- "follow_ups": An array of follow-up items mentioned (strings).

Return ONLY valid JSON, no extra text."""

        result = await self.generate(prompt, temperature=0.3, format="json")
        try:
            parsed = json.loads(result["response"])
        except json.JSONDecodeError:
            logger.warning("Failed to parse summary JSON, returning raw response")
            parsed = {
                "executive_summary": result["response"],
                "key_points": [],
                "decisions_made": [],
                "follow_ups": [],
            }
        parsed["_model"] = result.get("model", self._default_model)
        parsed["_tokens"] = result.get("tokens", 0)
        logger.info("Summarised transcript for '%s'", meeting_title)
        return parsed

    # ------------------------------------------------------------------
    # Domain-specific: task extraction
    # ------------------------------------------------------------------

    async def extract_tasks(self, transcript_text: str) -> list[dict[str, Any]]:
        """Extract action items / tasks from a transcript.

        Args:
            transcript_text: Full transcript with speaker labels.

        Returns:
            List of task dicts with title, assignee, due_date, priority, context.
        """
        prompt = f"""You are an expert meeting analyst. Extract all action items and tasks from the following meeting transcript.

Transcript:
{transcript_text}

Return a JSON array of task objects. Each object must have:
- "title": Short description of the action item.
- "assignee": Person responsible (use the speaker name, or "Unassigned" if unclear).
- "due_date": Due date if mentioned (ISO format YYYY-MM-DD), or null.
- "priority": One of "low", "medium", "high", "critical".
- "context": Brief quote or context from the transcript explaining the task.

Return ONLY a valid JSON array, no extra text."""

        result = await self.generate(prompt, temperature=0.2, format="json")
        try:
            parsed = json.loads(result["response"])
            if isinstance(parsed, dict) and "tasks" in parsed:
                parsed = parsed["tasks"]
            if not isinstance(parsed, list):
                parsed = [parsed]
        except json.JSONDecodeError:
            logger.warning("Failed to parse tasks JSON")
            parsed = []
        logger.info("Extracted %d tasks from transcript", len(parsed))
        return parsed

    # ------------------------------------------------------------------
    # Domain-specific: sentiment analysis
    # ------------------------------------------------------------------

    async def analyze_sentiment(
        self,
        transcript_text: str,
        speaker_names: list[str],
    ) -> dict[str, Any]:
        """Deep sentiment analysis of a transcript using the LLM.

        Args:
            transcript_text: Full transcript with speaker labels.
            speaker_names: List of participant names.

        Returns:
            Dict with overall_sentiment, per_speaker, sentiment_arc.
        """
        speakers_str = ", ".join(speaker_names)
        prompt = f"""You are a sentiment analysis expert. Analyse the following meeting transcript.

Speakers: {speakers_str}

Transcript:
{transcript_text}

Return a JSON object with:
- "overall_sentiment": Overall meeting sentiment ("positive", "negative", "neutral", or "mixed") with a brief explanation.
- "per_speaker": An object mapping each speaker name to a brief sentiment summary string.
- "sentiment_arc": An array of 3-5 objects describing how sentiment changed over the course of the meeting, each with "phase" (e.g. "Opening", "Mid-meeting", "Closing"), "sentiment" label, and "description".

Return ONLY valid JSON, no extra text."""

        result = await self.generate(prompt, temperature=0.3, format="json")
        try:
            parsed = json.loads(result["response"])
        except json.JSONDecodeError:
            logger.warning("Failed to parse sentiment JSON")
            parsed = {
                "overall_sentiment": "unknown",
                "per_speaker": {},
                "sentiment_arc": [],
            }
        logger.info("Completed deep sentiment analysis")
        return parsed

    # ------------------------------------------------------------------
    # Embeddings
    # ------------------------------------------------------------------

    async def generate_embedding(self, text: str) -> list[float]:
        """Generate a 768-dimension embedding vector for a text.

        Args:
            text: Input text to embed.

        Returns:
            List of floats (768 dimensions, nomic-embed-text).
        """
        try:
            payload = {
                "model": self._embedding_model,
                "prompt": text,
            }
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(f"{self._base_url}/api/embeddings", json=payload)
                resp.raise_for_status()

            data = resp.json()
            embedding = data.get("embedding", [])
            logger.debug("Generated embedding (%d dims)", len(embedding))
            return embedding
        except Exception as exc:
            logger.error("Embedding generation failed: %s", exc, exc_info=True)
            raise

    async def generate_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """Batch embed multiple texts.

        Args:
            texts: List of texts to embed.

        Returns:
            List of embedding vectors (one per input text).
        """
        embeddings: list[list[float]] = []
        for text in texts:
            emb = await self.generate_embedding(text)
            embeddings.append(emb)
        logger.info("Batch generated %d embeddings", len(embeddings))
        return embeddings

    # ------------------------------------------------------------------
    # Model management
    # ------------------------------------------------------------------

    async def list_models(self) -> list[dict[str, Any]]:
        """List all locally installed Ollama models.

        Returns:
            List of model info dicts.
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(f"{self._base_url}/api/tags")
                resp.raise_for_status()
            data = resp.json()
            models = data.get("models", [])
            logger.debug("Listed %d models", len(models))
            return models
        except Exception as exc:
            logger.error("Failed to list models: %s", exc, exc_info=True)
            raise

    async def pull_model(self, model_name: str) -> AsyncGenerator[dict[str, Any], None]:
        """Pull (download) a model, streaming progress updates.

        Args:
            model_name: Model name to pull (e.g. 'llama3.2:3b').

        Yields:
            Progress dicts with status, digest, total, completed keys.
        """
        try:
            payload = {"name": model_name, "stream": True}
            async with httpx.AsyncClient(timeout=600.0) as client:
                async with client.stream(
                    "POST", f"{self._base_url}/api/pull", json=payload
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                            yield data
                        except json.JSONDecodeError:
                            continue
            logger.info("Successfully pulled model %s", model_name)
        except Exception as exc:
            logger.error("Failed to pull model %s: %s", model_name, exc, exc_info=True)
            raise

    async def delete_model(self, model_name: str) -> bool:
        """Delete a locally installed model.

        Args:
            model_name: Model name to delete.

        Returns:
            True if successfully deleted.
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.delete(
                    f"{self._base_url}/api/delete",
                    json={"name": model_name},
                )
                resp.raise_for_status()
            logger.info("Deleted model %s", model_name)
            return True
        except Exception as exc:
            logger.error("Failed to delete model %s: %s", model_name, exc, exc_info=True)
            raise

    async def model_info(self, model_name: str) -> dict[str, Any]:
        """Get detailed information about a model.

        Args:
            model_name: Model name to query.

        Returns:
            Dict with model details (parameters, template, licence, etc.).
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self._base_url}/api/show",
                    json={"name": model_name},
                )
                resp.raise_for_status()
            data = resp.json()
            logger.debug("Retrieved info for model %s", model_name)
            return data
        except Exception as exc:
            logger.error("Failed to get model info for %s: %s", model_name, exc, exc_info=True)
            raise


# Singleton instance
ollama_client = OllamaClient()
