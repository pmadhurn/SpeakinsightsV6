"""
SpeakInsights v3 — WhisperX Client
Async HTTP client for the self-hosted WhisperX transcription service.
"""

import asyncio
import logging
import time
from pathlib import Path
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Circuit-breaker constants
# ---------------------------------------------------------------------------
_CB_FAILURE_THRESHOLD = 3     # Open circuit after N consecutive failures
_CB_RECOVERY_TIMEOUT = 30.0  # Seconds to wait before probing again
_CHUNK_TIMEOUT = 45.0         # Must comfortably cover alignment-model loads


class WhisperXClient:
    """Async client wrapping the WhisperX HTTP transcription service."""

    def __init__(self) -> None:
        self._base_url: str = settings.WHISPERX_URL.rstrip("/")
        self._default_language: str = settings.DEFAULT_LANGUAGE

        # Circuit-breaker state
        self._consecutive_failures: int = 0
        self._circuit_open_since: float | None = None

        logger.info("WhisperXClient initialised (url=%s)", self._base_url)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_segments(raw_segments: list[dict]) -> list[dict[str, Any]]:
        """Parse WhisperX response into a standardised segment format.

        The WhisperX service already applies any timestamp_offset in its
        ``format_result`` method, so we must NOT add an offset here — doing
        so would double the timestamps.

        Args:
            raw_segments: Raw segments from WhisperX (already offset-adjusted).

        Returns:
            List of normalised segment dicts.
        """
        parsed: list[dict[str, Any]] = []
        for idx, seg in enumerate(raw_segments):
            words = []
            for w in seg.get("words", []):
                words.append({
                    "word": w.get("word", ""),
                    "start": round((w.get("start", 0.0) or 0.0), 3),
                    "end": round((w.get("end", 0.0) or 0.0), 3),
                    "confidence": round(w.get("score", w.get("confidence", 0.0)) or 0.0, 4),
                })

            parsed.append({
                "index": idx,
                "start": round((seg.get("start", 0.0) or 0.0), 3),
                "end": round((seg.get("end", 0.0) or 0.0), 3),
                "text": seg.get("text", "").strip(),
                "confidence": round(seg.get("score", seg.get("confidence", 0.0)) or 0.0, 4),
                "words": words,
                "language": seg.get("language", None),
            })
        return parsed

    # ------------------------------------------------------------------
    # Circuit breaker helpers
    # ------------------------------------------------------------------

    def _record_success(self) -> None:
        """Reset the circuit breaker on a successful request."""
        if self._consecutive_failures > 0:
            logger.info(
                "WhisperX recovered after %d consecutive failures",
                self._consecutive_failures,
            )
        self._consecutive_failures = 0
        self._circuit_open_since = None

    def _record_failure(self) -> None:
        """Track a failure; open the circuit if threshold is reached."""
        self._consecutive_failures += 1
        if self._consecutive_failures >= _CB_FAILURE_THRESHOLD and self._circuit_open_since is None:
            self._circuit_open_since = time.monotonic()
            logger.warning(
                "WhisperX circuit OPEN after %d consecutive failures — "
                "skipping requests for %.0fs",
                self._consecutive_failures,
                _CB_RECOVERY_TIMEOUT,
            )

    def _is_circuit_open(self) -> bool:
        """Return True if we should skip the request (circuit is open)."""
        if self._circuit_open_since is None:
            return False
        elapsed = time.monotonic() - self._circuit_open_since
        if elapsed >= _CB_RECOVERY_TIMEOUT:
            # Allow a single probe request
            logger.info("WhisperX circuit half-open — sending probe request")
            self._circuit_open_since = None  # will re-open on next failure
            return False
        return True

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def transcribe_audio_chunk(
        self,
        audio_bytes: bytes,
        language: str = "auto",
        timestamp_offset: float = 0.0,
    ) -> list[dict[str, Any]]:
        """Send an audio chunk to the WhisperX service for transcription.

        Uses a circuit-breaker so that when WhisperX is overloaded (e.g.
        loading alignment models) we stop hammering it with requests that
        would pile up and make the problem worse.

        Args:
            audio_bytes: Raw audio bytes (WAV/OGG).
            language: Language code or 'auto' for detection.
            timestamp_offset: Time offset (seconds) to apply to all timestamps.

        Returns:
            List of standardised transcript segments with word-level timestamps.

        Raises:
            WhisperXUnavailableError: If the circuit breaker is open.
            httpx.HTTPStatusError: On non-transient HTTP errors from WhisperX.
            Exception: On unexpected errors.
        """
        # ── Circuit breaker gate ──
        if self._is_circuit_open():
            logger.debug(
                "WhisperX circuit open — dropping chunk (offset=%.1fs)",
                timestamp_offset,
            )
            raise WhisperXUnavailableError(
                f"Circuit open ({self._consecutive_failures} consecutive failures)"
            )

        try:
            lang = language if language != "auto" else None
            max_retries = 2
            for attempt in range(1, max_retries + 1):
                try:
                    async with httpx.AsyncClient(timeout=_CHUNK_TIMEOUT) as client:
                        files = {"file": ("chunk.wav", audio_bytes, "audio/wav")}
                        data: dict[str, Any] = {}
                        if lang:
                            data["language"] = lang
                        if timestamp_offset:
                            data["timestamp_offset"] = str(timestamp_offset)

                        response = await client.post(
                            f"{self._base_url}/transcribe",
                            files=files,
                            data=data,
                        )
                        response.raise_for_status()

                    result = response.json()
                    segments = result.get("segments", result if isinstance(result, list) else [])
                    parsed = self._parse_segments(segments)
                    logger.debug(
                        "Transcribed audio chunk: %d segments (offset=%.1fs)",
                        len(parsed),
                        timestamp_offset,
                    )
                    self._record_success()
                    return parsed
                except (httpx.ReadTimeout, httpx.ConnectError, httpx.ConnectTimeout) as retry_exc:
                    if attempt < max_retries:
                        logger.warning(
                            "WhisperX chunk request failed (attempt %d/%d), retrying: %s",
                            attempt, max_retries, retry_exc,
                        )
                        await asyncio.sleep(2)
                    else:
                        self._record_failure()
                        raise
            return []  # unreachable
        except httpx.HTTPStatusError as exc:
            self._record_failure()
            logger.error(
                "WhisperX HTTP error %s: %s", exc.response.status_code, exc.response.text
            )
            raise
        except WhisperXUnavailableError:
            raise
        except Exception as exc:
            self._record_failure()
            logger.error("Failed to transcribe audio chunk: %s", exc, exc_info=True)
            raise

    async def transcribe_file(
        self,
        file_path: str,
        language: str = "auto",
    ) -> list[dict[str, Any]]:
        """Send a complete audio file to WhisperX for full transcription.

        Used post-meeting for processing individual participant tracks with
        higher accuracy.

        Args:
            file_path: Path to the audio file on disk.
            language: Language code or 'auto'.

        Returns:
            List of standardised transcript segments.
        """
        try:
            path = Path(file_path)
            if not path.exists():
                raise FileNotFoundError(f"Audio file not found: {file_path}")

            lang = language if language != "auto" else None
            audio_bytes = path.read_bytes()

            mime_map = {
                ".ogg": "audio/ogg",
                ".wav": "audio/wav",
                ".mp3": "audio/mpeg",
                ".flac": "audio/flac",
                ".m4a": "audio/mp4",
                ".webm": "audio/webm",
                ".mp4": "video/mp4",
                ".aac": "audio/aac",
                ".opus": "audio/opus",
            }
            mime = mime_map.get(path.suffix.lower(), "audio/wav")

            max_retries = 3
            for attempt in range(1, max_retries + 1):
                try:
                    async with httpx.AsyncClient(timeout=600.0) as client:
                        files = {"file": (path.name, audio_bytes, mime)}
                        data: dict[str, Any] = {}
                        if lang:
                            data["language"] = lang

                        response = await client.post(
                            f"{self._base_url}/transcribe-file",
                            files=files,
                            data=data,
                        )
                        response.raise_for_status()

                    result = response.json()
                    segments = result.get("segments", result if isinstance(result, list) else [])
                    parsed = self._parse_segments(segments)
                    logger.info(
                        "Transcribed file %s: %d segments", path.name, len(parsed)
                    )
                    return parsed
                except (httpx.ReadTimeout, httpx.ConnectError, httpx.ConnectTimeout) as retry_exc:
                    if attempt < max_retries:
                        wait = attempt * 10
                        logger.warning(
                            "WhisperX request failed (attempt %d/%d), retrying in %ds: %s",
                            attempt, max_retries, wait, retry_exc,
                        )
                        import asyncio
                        await asyncio.sleep(wait)
                    else:
                        raise
            return []  # unreachable, but satisfies type checker
        except httpx.HTTPStatusError as exc:
            logger.error(
                "WhisperX HTTP error %s: %s", exc.response.status_code, exc.response.text
            )
            raise
        except Exception as exc:
            logger.error("Failed to transcribe file %s: %s", file_path, exc, exc_info=True)
            raise

    async def health_check(self) -> bool:
        """Check if the WhisperX service is running and reachable.

        Returns:
            True if healthy, False otherwise.
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self._base_url}/health")
                healthy = response.status_code == 200
                logger.debug("WhisperX health check: %s", "OK" if healthy else "FAIL")
                return healthy
        except Exception as exc:
            logger.warning("WhisperX health check failed: %s", exc)
            return False


class WhisperXUnavailableError(Exception):
    """Raised when the circuit breaker is open (WhisperX is known-down)."""


# Singleton instance
whisperx_client = WhisperXClient()
