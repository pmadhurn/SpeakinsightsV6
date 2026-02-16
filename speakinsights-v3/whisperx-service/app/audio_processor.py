"""
SpeakInsights v3 — Audio Processor
Handles audio file validation, format detection, and temporary file management.
"""

import logging
import os
import tempfile
import uuid
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Supported audio formats
SUPPORTED_FORMATS = {
    ".wav",
    ".mp3",
    ".flac",
    ".ogg",
    ".m4a",
    ".webm",
    ".wma",
    ".aac",
    ".opus",
    ".mp4",  # Video files with audio track
    ".mkv",
    ".avi",
}

# Maximum file size (500MB)
MAX_FILE_SIZE = 500 * 1024 * 1024

# Temp directory for uploaded files
TEMP_DIR = tempfile.gettempdir()


def get_temp_filepath(original_filename: str) -> str:
    """
    Generate a unique temporary file path preserving the original extension.
    
    Args:
        original_filename: Original uploaded filename
        
    Returns:
        Path to temporary file
    """
    ext = Path(original_filename).suffix.lower() if original_filename else ".wav"
    if ext not in SUPPORTED_FORMATS:
        ext = ".wav"  # Default fallback
    
    unique_name = f"whisperx_{uuid.uuid4().hex}{ext}"
    return os.path.join(TEMP_DIR, unique_name)


def validate_audio_file(filename: str, file_size: Optional[int] = None) -> tuple[bool, str]:
    """
    Validate an uploaded audio file.
    
    Args:
        filename: Original filename
        file_size: File size in bytes (if known)
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not filename:
        return False, "No filename provided"

    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_FORMATS:
        return False, (
            f"Unsupported audio format: '{ext}'. "
            f"Supported formats: {', '.join(sorted(SUPPORTED_FORMATS))}"
        )

    if file_size is not None and file_size > MAX_FILE_SIZE:
        size_mb = file_size / (1024 * 1024)
        max_mb = MAX_FILE_SIZE / (1024 * 1024)
        return False, f"File too large: {size_mb:.1f}MB (max: {max_mb:.0f}MB)"

    return True, ""


async def save_upload_to_temp(upload_file, original_filename: str) -> str:
    """
    Save an uploaded file to a temporary location.
    
    Args:
        upload_file: FastAPI UploadFile object
        original_filename: Original filename
        
    Returns:
        Path to the saved temporary file
    """
    temp_path = get_temp_filepath(original_filename)
    
    try:
        content = await upload_file.read()
        
        # Validate file size
        is_valid, error = validate_audio_file(original_filename, len(content))
        if not is_valid:
            raise ValueError(error)
        
        with open(temp_path, "wb") as f:
            f.write(content)
        
        logger.info(
            f"Saved upload to temp: {temp_path} "
            f"({len(content) / (1024*1024):.2f}MB)"
        )
        return temp_path
        
    except ValueError:
        raise
    except Exception as e:
        # Clean up on error
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        raise RuntimeError(f"Failed to save uploaded file: {e}")


def cleanup_temp_file(filepath: str) -> None:
    """Safely remove a temporary file."""
    try:
        if filepath and os.path.exists(filepath):
            os.unlink(filepath)
            logger.debug(f"Cleaned up temp file: {filepath}")
    except Exception as e:
        logger.warning(f"Failed to clean up temp file {filepath}: {e}")
