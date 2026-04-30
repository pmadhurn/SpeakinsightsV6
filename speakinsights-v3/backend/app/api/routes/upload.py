"""
SpeakInsights v3 — Upload Routes
Allows users to upload audio/video files to create a meeting
that goes through the full post-processing pipeline.
"""

import asyncio
import logging
import os
import secrets
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.config import settings
from app.core.post_processing import post_processing
from app.core.recording_manager import recording_manager
from app.models.meeting import Meeting

logger = logging.getLogger(__name__)

router = APIRouter()

# Supported upload formats
SUPPORTED_FORMATS = {
    ".wav", ".mp3", ".flac", ".ogg", ".m4a", ".webm",
    ".wma", ".aac", ".opus", ".mp4", ".mkv", ".avi",
    ".mov", ".3gp", ".amr",
}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB


async def _generate_code(db: AsyncSession) -> str:
    """Generate a unique meeting code, retrying on collision."""
    for _ in range(10):
        code = f"si-{secrets.token_hex(4)}"
        result = await db.execute(select(Meeting).where(Meeting.code == code))
        if not result.scalar_one_or_none():
            return code
    raise RuntimeError("Failed to generate a unique meeting code after 10 attempts")


@router.post("")
async def upload_meeting(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Audio or video file to process"),
    title: str = Form(..., description="Meeting title"),
    host_name: str = Form(default="Uploaded", description="Host / uploader name"),
    language: str = Form(default="auto", description="Language code or 'auto'"),
    db: AsyncSession = Depends(get_db),
):
    """Upload an audio/video file to create a meeting with full processing.

    The file is saved to storage, a meeting record is created, and the full
    post-processing pipeline is triggered in the background:
      - Transcription with speaker diarization via WhisperX
      - Sentiment analysis
      - Embedding generation
      - AI summary + task extraction
      - Calendar export
    """
    # ── Validate file ──
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: '{ext}'. Supported: {', '.join(sorted(SUPPORTED_FORMATS))}",
        )

    # Read the file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        size_mb = len(content) / (1024 * 1024)
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {size_mb:.1f}MB (max: {MAX_FILE_SIZE // (1024 * 1024)}MB)",
        )

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # ── Create meeting record ──
    meeting_id = uuid.uuid4()
    code = await _generate_code(db)

    meeting = Meeting(
        id=meeting_id,
        title=title.strip() or f"Uploaded Meeting ({file.filename})",
        description=f"Uploaded file: {file.filename}",
        code=code,
        language=language,
        status="processing",
        host_name=host_name.strip() or "Uploaded",
        started_at=datetime.now(timezone.utc),
        ended_at=datetime.now(timezone.utc),
    )
    db.add(meeting)
    await db.flush()

    # ── Save file to storage ──
    meeting_dir = Path(settings.STORAGE_PATH) / "recordings" / str(meeting_id)
    meeting_dir.mkdir(parents=True, exist_ok=True)

    # Save as composite file (the pipeline's fallback looks for MP4 / audio files)
    safe_name = f"uploaded_{meeting_id}{ext}"
    file_path = meeting_dir / safe_name
    with open(file_path, "wb") as f:
        f.write(content)

    logger.info(
        "Uploaded file saved: %s (%.1f MB) for meeting %s",
        file_path, len(content) / (1024 * 1024), meeting_id,
    )

    # If the uploaded file is a video, also extract audio as WAV
    # so the pipeline can find it directly
    audio_path = meeting_dir / f"extracted_audio_{meeting_id}.wav"
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-i", str(file_path),
            "-vn",                   # No video
            "-acodec", "pcm_s16le",  # WAV PCM 16-bit
            "-ar", "16000",          # 16kHz (optimal for Whisper)
            "-ac", "1",              # Mono
            "-y",                    # Overwrite
            str(audio_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            logger.warning(
                "ffmpeg audio extraction failed (rc=%d): %s",
                proc.returncode,
                stderr.decode().strip()[-500:],
            )
            # If extraction fails and the original is already audio, use it directly
            audio_path = file_path
        else:
            logger.info(
                "Audio extracted to %s (%.1f MB)",
                audio_path,
                audio_path.stat().st_size / (1024 * 1024),
            )
    except FileNotFoundError:
        logger.warning("ffmpeg not found — using original file for transcription")
        audio_path = file_path

    await db.commit()

    # ── Trigger post-processing in background ──
    background_tasks.add_task(
        post_processing.process_meeting,
        str(meeting_id),
    )

    logger.info(
        "Upload complete — meeting %s (%s) queued for post-processing",
        meeting_id, title,
    )

    return {
        "status": "processing",
        "meeting_id": str(meeting_id),
        "code": code,
        "title": meeting.title,
        "message": f"File '{file.filename}' uploaded successfully. Processing started.",
        "file_size_mb": round(len(content) / (1024 * 1024), 1),
    }
