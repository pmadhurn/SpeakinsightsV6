"""
SpeakInsights v3 — Recording Manager
File-system utilities for meeting recordings and storage paths.
"""

import asyncio
import logging
import os
import shutil
from pathlib import Path
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


class RecordingManager:
    """Manages recording file paths, directories, and metadata."""

    def __init__(self) -> None:
        self._storage_path: str = settings.STORAGE_PATH
        logger.info("RecordingManager initialised (storage=%s)", self._storage_path)

    # ------------------------------------------------------------------
    # Path helpers
    # ------------------------------------------------------------------

    def get_recording_path(self, meeting_id: str, record_type: str = "composite") -> str:
        """Get the expected file path for a recording.

        Args:
            meeting_id: Meeting UUID.
            record_type: 'composite' or 'individual'.

        Returns:
            Absolute file path string.
        """
        if record_type == "composite":
            return str(
                Path(self._storage_path) / "recordings" / meeting_id / f"composite_{meeting_id}.mp4"
            )
        return str(
            Path(self._storage_path) / "recordings" / meeting_id
        )

    def get_individual_track_path(self, meeting_id: str, participant_name: str) -> str:
        """Get the file path for an individual participant audio track.

        Args:
            meeting_id: Meeting UUID.
            participant_name: Name/identity of the participant.

        Returns:
            Absolute file path string.
        """
        return str(
            Path(self._storage_path)
            / "recordings"
            / meeting_id
            / f"{participant_name}_{meeting_id}.ogg"
        )

    # ------------------------------------------------------------------
    # Directory / listing
    # ------------------------------------------------------------------

    def list_meeting_recordings(self, meeting_id: str) -> list[dict[str, str]]:
        """List all recording files for a meeting.

        Args:
            meeting_id: Meeting UUID.

        Returns:
            List of dicts with name, path, size, format keys.
        """
        meeting_dir = Path(self._storage_path) / "recordings" / meeting_id
        if not meeting_dir.exists():
            logger.debug("No recording directory for meeting %s", meeting_id)
            return []

        recordings: list[dict[str, str]] = []
        for entry in meeting_dir.iterdir():
            if entry.is_file():
                recordings.append({
                    "name": entry.name,
                    "path": str(entry),
                    "size": str(entry.stat().st_size),
                    "format": entry.suffix.lstrip("."),
                })
        logger.debug("Found %d recordings for meeting %s", len(recordings), meeting_id)
        return recordings

    def ensure_meeting_directory(self, meeting_id: str) -> str:
        """Create the recordings directory for a meeting if it doesn't exist.

        Args:
            meeting_id: Meeting UUID.

        Returns:
            Path to the created directory.
        """
        meeting_dir = Path(self._storage_path) / "recordings" / meeting_id
        meeting_dir.mkdir(parents=True, exist_ok=True)
        logger.debug("Ensured directory: %s", meeting_dir)
        return str(meeting_dir)

    # ------------------------------------------------------------------
    # File utilities
    # ------------------------------------------------------------------

    def get_file_size(self, file_path: str) -> int:
        """Get the size of a file in bytes.

        Args:
            file_path: Absolute path to the file.

        Returns:
            File size in bytes, or 0 if file not found.
        """
        try:
            return Path(file_path).stat().st_size
        except FileNotFoundError:
            logger.warning("File not found for size check: %s", file_path)
            return 0

    async def get_audio_duration(self, file_path: str) -> Optional[float]:
        """Get the duration of an audio/video file using ffprobe.

        Args:
            file_path: Path to the media file.

        Returns:
            Duration in seconds, or None if ffprobe fails.
        """
        try:
            proc = await asyncio.create_subprocess_exec(
                "ffprobe",
                "-v", "quiet",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                file_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()

            if proc.returncode != 0:
                logger.warning(
                    "ffprobe failed for %s: %s", file_path, stderr.decode().strip()
                )
                return None

            duration = float(stdout.decode().strip())
            logger.debug("Duration of %s: %.2fs", file_path, duration)
            return duration
        except FileNotFoundError:
            logger.warning("ffprobe not found — cannot determine duration")
            return None
        except Exception as exc:
            logger.error("Failed to get duration for %s: %s", file_path, exc, exc_info=True)
            return None

    def get_composite_path(self, meeting_id: str) -> str | None:
        """Return the composite recording path if it exists on disk.

        Args:
            meeting_id: Meeting UUID.

        Returns:
            Absolute path to the composite MP4, or None if it doesn't exist.
        """
        expected = Path(self._storage_path) / "recordings" / meeting_id / f"composite_{meeting_id}.mp4"
        if expected.exists():
            return str(expected)

        # Fallback: look for any .mp4 file in the meeting directory
        meeting_dir = Path(self._storage_path) / "recordings" / meeting_id
        if meeting_dir.exists():
            for entry in meeting_dir.iterdir():
                if entry.is_file() and entry.suffix.lower() == ".mp4":
                    return str(entry)

        return None

    async def extract_audio_from_composite(
        self,
        meeting_id: str,
        speaker_name: str = "Speaker",
    ) -> str | None:
        """Extract audio from the composite MP4 recording to a WAV file.

        Uses ffmpeg to pull just the audio channel.  The resulting WAV file
        is stored alongside the original composite in the meeting's recording
        directory so it can be reused by subsequent retranscribe calls.

        Args:
            meeting_id: Meeting UUID.
            speaker_name: Label for the extracted audio (used in filename).

        Returns:
            Path to the extracted WAV file, or None on failure.
        """
        composite_path = self.get_composite_path(meeting_id)
        if not composite_path:
            logger.warning("No composite recording found for meeting %s", meeting_id)
            return None

        out_path = str(
            Path(self._storage_path)
            / "recordings"
            / meeting_id
            / f"extracted_audio_{meeting_id}.wav"
        )

        # Skip extraction if the file already exists (idempotent)
        if Path(out_path).exists():
            logger.info("Extracted audio already exists: %s", out_path)
            return out_path

        logger.info(
            "Extracting audio from composite %s → %s", composite_path, out_path
        )

        try:
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg",
                "-i", composite_path,
                "-vn",                   # No video
                "-acodec", "pcm_s16le",  # WAV PCM 16-bit
                "-ar", "16000",          # 16kHz (optimal for Whisper)
                "-ac", "1",              # Mono
                "-y",                    # Overwrite
                out_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()

            if proc.returncode != 0:
                logger.error(
                    "ffmpeg audio extraction failed (rc=%d): %s",
                    proc.returncode,
                    stderr.decode().strip()[-500:],
                )
                return None

            size = Path(out_path).stat().st_size
            logger.info(
                "Audio extracted successfully: %s (%.1f MB)",
                out_path,
                size / (1024 * 1024),
            )
            return out_path

        except FileNotFoundError:
            logger.error("ffmpeg not found — cannot extract audio")
            return None
        except Exception as exc:
            logger.error(
                "Failed to extract audio from composite for meeting %s: %s",
                meeting_id,
                exc,
                exc_info=True,
            )
            return None

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    def cleanup_temp_files(self, meeting_id: str) -> None:
        """Remove temporary processing files for a meeting.

        Args:
            meeting_id: Meeting UUID.
        """
        temp_dir = Path(self._storage_path) / "temp" / meeting_id
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
            logger.info("Cleaned up temp files for meeting %s", meeting_id)
        else:
            logger.debug("No temp directory to clean for meeting %s", meeting_id)


# Singleton instance
recording_manager = RecordingManager()
