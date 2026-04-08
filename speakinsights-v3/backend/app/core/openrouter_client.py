"""
SpeakInsights v3 — OpenRouter Client
Async client for OpenRouter API: generation, chat, summarisation,
task extraction, sentiment analysis.
Mirrors the OllamaClient interface so they can be swapped seamlessly.
Embeddings still use Ollama (OpenRouter doesn't provide embedding endpoints).
"""

import asyncio
import json
import logging
from typing import Any, AsyncGenerator, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class OpenRouterClient:
    """Async client for the OpenRouter API (chat completions with reasoning)."""

    def __init__(self) -> None:
        self._api_key: str = settings.OPENROUTER_API_KEY
        self._default_model: str = settings.OPENROUTER_MODEL
        self._enable_reasoning: bool = settings.OPENROUTER_REASONING
        logger.info(
            "OpenRouterClient initialised (model=%s, reasoning=%s)",
            self._default_model,
            self._enable_reasoning,
        )

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://speakinsights.app",
            "X-Title": "SpeakInsights",
        }

    @staticmethod
    def _extract_json(text: str) -> Any:
        """Extract JSON from a response that may be wrapped in markdown code fences."""
        import re
        # Strip markdown code fences like ```json ... ``` or ``` ... ```
        cleaned = re.sub(r'^```(?:json)?\s*', '', text.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r'```\s*$', '', cleaned.strip())
        # Try parsing the cleaned text
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass
        # Fallback: find the first { ... } or [ ... ] block
        for start_char, end_char in [('{', '}'), ('[', ']')]:
            start = text.find(start_char)
            if start == -1:
                continue
            depth = 0
            for i in range(start, len(text)):
                if text[i] == start_char:
                    depth += 1
                elif text[i] == end_char:
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start:i + 1])
                        except json.JSONDecodeError:
                            break
        raise json.JSONDecodeError("No valid JSON found", text, 0)

    # ------------------------------------------------------------------
    # Generic generation (via chat completions)
    # ------------------------------------------------------------------

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        format: str = "json",
        temperature: float = 0.3,
        max_tokens: int = 16384,
    ) -> dict[str, Any]:
        """Generic LLM generation call via OpenRouter chat completions.

        Args:
            prompt: The prompt text.
            model: Model name override.
            format: 'json' to request JSON output.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.

        Returns:
            Dict with keys: response (str), model (str), tokens (int).
        """
        model = model or self._default_model
        max_retries = 3
        last_exc: Optional[Exception] = None

        system_content = "You are a helpful AI assistant."
        if format == "json":
            system_content += " Always respond with valid JSON only, no extra text."

        for attempt in range(1, max_retries + 1):
            try:
                payload: dict[str, Any] = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_content},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }

                if self._enable_reasoning:
                    payload["reasoning"] = {"enabled": True}

                async with httpx.AsyncClient(timeout=300.0) as client:
                    resp = await client.post(
                        f"{OPENROUTER_BASE_URL}/chat/completions",
                        headers=self._headers(),
                        json=payload,
                    )
                    resp.raise_for_status()

                data = resp.json()
                choice = data.get("choices", [{}])[0]
                message = choice.get("message", {})
                usage = data.get("usage", {})

                logger.debug("OpenRouter generate completed (model=%s)", model)
                return {
                    "response": message.get("content", ""),
                    "model": data.get("model", model),
                    "tokens": usage.get("completion_tokens", 0),
                }
            except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
                last_exc = exc
                if attempt < max_retries:
                    wait = attempt * 5
                    logger.warning(
                        "OpenRouter generate connection failed (attempt %d/%d), retrying in %ds: %s",
                        attempt, max_retries, wait, exc,
                    )
                    await asyncio.sleep(wait)
                else:
                    logger.error(
                        "OpenRouter generate failed after %d attempts: %s",
                        max_retries, exc, exc_info=True,
                    )
                    raise
            except Exception as exc:
                logger.error("OpenRouter generate failed: %s", exc, exc_info=True)
                raise
        raise last_exc  # unreachable, satisfies type checker

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
            chunks: list[str] = []
            async for chunk in self.chat_stream(messages, model):
                chunks.append(chunk)
            return {"response": "".join(chunks), "model": model or self._default_model}

        model = model or self._default_model
        try:
            payload: dict[str, Any] = {
                "model": model,
                "messages": messages,
                "stream": False,
                "max_tokens": 16384,
            }

            if self._enable_reasoning:
                payload["reasoning"] = {"enabled": True}

            async with httpx.AsyncClient(timeout=300.0) as client:
                resp = await client.post(
                    f"{OPENROUTER_BASE_URL}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
                resp.raise_for_status()

            data = resp.json()
            choice = data.get("choices", [{}])[0]
            message = choice.get("message", {})
            usage = data.get("usage", {})

            return {
                "response": message.get("content", ""),
                "model": data.get("model", model),
                "tokens": usage.get("completion_tokens", 0),
                "reasoning_details": message.get("reasoning_details"),
            }
        except Exception as exc:
            logger.error("OpenRouter chat failed: %s", exc, exc_info=True)
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
            Text chunks as they arrive from OpenRouter.
        """
        model = model or self._default_model
        try:
            payload: dict[str, Any] = {
                "model": model,
                "messages": messages,
                "stream": True,
                "max_tokens": 16384,
            }

            if self._enable_reasoning:
                payload["reasoning"] = {"enabled": True}

            async with httpx.AsyncClient(timeout=300.0) as client:
                async with client.stream(
                    "POST",
                    f"{OPENROUTER_BASE_URL}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        # SSE format: "data: {...}"
                        if line.startswith("data: "):
                            line = line[6:]
                        if line.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(line)
                            delta = data.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
        except Exception as exc:
            logger.error("OpenRouter chat_stream failed: %s", exc, exc_info=True)
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
            Dict with executive_summary, key_points, decisions_made, follow_ups,
            keywords, topics, themes.
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
- "keywords": An array of 5-10 important keywords from the meeting (single words or short phrases).
- "topics": An array of 3-6 main topics/subjects discussed in the meeting (short phrases).
- "themes": An array of 2-4 overarching themes or recurring patterns in the discussion (short descriptive phrases).

Return ONLY valid JSON, no extra text."""

        result = await self.generate(prompt, temperature=0.3, format="json")
        try:
            parsed = self._extract_json(result["response"])
        except json.JSONDecodeError:
            logger.warning("Failed to parse summary JSON, returning raw response")
            parsed = {
                "executive_summary": result["response"],
                "key_points": [],
                "decisions_made": [],
                "follow_ups": [],
                "keywords": [],
                "topics": [],
                "themes": [],
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
            parsed = self._extract_json(result["response"])
            if isinstance(parsed, dict):
                for key in ("tasks", "actionItems", "action_items", "items"):
                    if key in parsed and isinstance(parsed[key], list):
                        parsed = parsed[key]
                        break
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
            parsed = self._extract_json(result["response"])
        except json.JSONDecodeError:
            logger.warning("Failed to parse sentiment JSON")
            parsed = {
                "overall_sentiment": "unknown",
                "per_speaker": {},
                "sentiment_arc": [],
            }
        logger.info("Completed deep sentiment analysis")
        return parsed


# Singleton instance (lazy — only created when OpenRouter is configured)
openrouter_client = OpenRouterClient() if settings.OPENROUTER_API_KEY else None
