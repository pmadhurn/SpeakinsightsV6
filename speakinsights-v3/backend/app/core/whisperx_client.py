"""
SpeakInsights v3 — WhisperX Client
Async HTTP client for the self-hosted WhisperX transcription service.
"""

import logging
from pathlib import Path
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class WhisperXClient:
    """Async client wrapping the WhisperX HTTP transcription service."""

    def __init__(self) -> None:
        self._base_url: str = settings.WHISPERX_URL.rstrip("/")
        self._default_language: str = settings.DEFAULT_LANGUAGE
        logger.info("WhisperXClient initialised (url=%s)", self._base_url)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_segments(raw_segments: list[dict], timestamp_offset: float = 0.0) -> list[dict[str, Any]]:
        """Parse WhisperX response into a standardised segment format.

        Args:
            raw_segments: Raw segments from WhisperX.
            timestamp_offset: Offset (seconds) to add to all timestamps.

        Returns:
            List of normalised segment dicts.
        """
        parsed: list[dict[str, Any]] = []
        for idx, seg in enumerate(raw_segments):
            words = []
            for w in seg.get("words", []):
                words.append({
                    "word": w.get("word", ""),
                    "start": round((w.get("start", 0.0) or 0.0) + timestamp_offset, 3),
                    "end": round((w.get("end", 0.0) or 0.0) + timestamp_offset, 3),
                    "confidence": round(w.get("score", w.get("confidence", 0.0)) or 0.0, 4),
                })

            parsed.append({
                "index": idx,
                "start": round((seg.get("start", 0.0) or 0.0) + timestamp_offset, 3),
                "end": round((seg.get("end", 0.0) or 0.0) + timestamp_offset, 3),
                "text": seg.get("text", "").strip(),
                "confidence": round(seg.get("score", seg.get("confidence", 0.0)) or 0.0, 4),
                "words": words,
                "language": seg.get("language", None),
            })
        return parsed

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

        Args:
            audio_bytes: Raw audio bytes (WAV/OGG).
            language: Language code or 'auto' for detection.
            timestamp_offset: Time offset (seconds) to apply to all timestamps.

        Returns:
            List of standardised transcript segments with word-level timestamps.
        """
        try:
            lang = language if language != "auto" else None
            async with httpx.AsyncClient(timeout=60.0) as client:
                files = {"audio": ("chunk.wav", audio_bytes, "audio/wav")}
                data: dict[str, Any] = {}
                if lang:
                    data["language"] = lang

                response = await client.post(
                    f"{self._base_url}/transcribe",
                    files=files,
                    data=data,
                )
                response.raise_for_status()

            result = response.json()
            segments = result.get("segments", result if isinstance(result, list) else [])
            parsed = self._parse_segments(segments, timestamp_offset)
            logger.debug(
                "Transcribed audio chunk: %d segments (offset=%.1fs)",
                len(parsed),
                timestamp_offset,
            )
            return parsed
        except httpx.HTTPStatusError as exc:
            logger.error(
                "WhisperX HTTP error %s: %s", exc.response.status_code, exc.response.text
            )
            raise
        except Exception as exc:
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

            mime = "audio/ogg" if path.suffix == ".ogg" else "audio/wav"

            async with httpx.AsyncClient(timeout=300.0) as client:
                files = {"audio": (path.name, audio_bytes, mime)}
                data: dict[str, Any] = {}
                if lang:
                    data["language"] = lang

                response = await client.post(
                    f"{self._base_url}/transcribe",
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


# Singleton instance
whisperx_client = WhisperXClient()
