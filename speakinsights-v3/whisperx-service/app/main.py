"""
SpeakInsights v3 — WhisperX Transcription Microservice
FastAPI service that loads WhisperX and provides HTTP endpoints for transcription.
"""

import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.audio_processor import (
    cleanup_temp_file,
    save_upload_to_temp,
    validate_audio_file,
)
from app.transcriber import SUPPORTED_LANGUAGES, WhisperXTranscriber

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("whisperx-service")

# ---------------------------------------------------------------------------
# Configuration from environment
# ---------------------------------------------------------------------------
MODEL_SIZE = os.getenv("MODEL_SIZE", "small")
DEVICE = os.getenv("DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("COMPUTE_TYPE", "int8")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "4"))
DEFAULT_LANGUAGE = os.getenv("DEFAULT_LANGUAGE", "auto")

# ---------------------------------------------------------------------------
# Global transcriber instance
# ---------------------------------------------------------------------------
transcriber = WhisperXTranscriber()


# ---------------------------------------------------------------------------
# Lifespan — load model on startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load WhisperX model on startup, cleanup on shutdown."""
    logger.info("=" * 60)
    logger.info("SpeakInsights WhisperX Service starting...")
    logger.info(f"  Model size  : {MODEL_SIZE}")
    logger.info(f"  Device      : {DEVICE}")
    logger.info(f"  Compute type: {COMPUTE_TYPE}")
    logger.info(f"  Batch size  : {BATCH_SIZE}")
    logger.info(f"  Default lang: {DEFAULT_LANGUAGE}")
    logger.info("=" * 60)

    try:
        transcriber.load_model(
            model_size=MODEL_SIZE,
            device=DEVICE,
            compute_type=COMPUTE_TYPE,
            batch_size=BATCH_SIZE,
        )
        logger.info("WhisperX model ready — service is operational.")
    except Exception as e:
        logger.error(f"FATAL: Failed to load WhisperX model: {e}")
        # Don't crash — allow health check to report model not loaded
        logger.warning("Service will start but transcription will not work.")

    yield

    # Shutdown cleanup
    logger.info("WhisperX service shutting down...")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SpeakInsights WhisperX Service",
    description="Speech-to-text transcription microservice powered by WhisperX",
    version="3.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins (internal service)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# GET /health — Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "model_loaded": transcriber.is_loaded,
        "model_size": transcriber.model_size or MODEL_SIZE,
        "device": transcriber.device,
        "compute_type": transcriber.compute_type,
        "batch_size": transcriber.batch_size,
        "supported_languages": list(SUPPORTED_LANGUAGES.keys()),
    }


# ---------------------------------------------------------------------------
# GET /languages — Supported languages
# ---------------------------------------------------------------------------
@app.get("/languages")
async def languages():
    """Return list of supported language codes and names."""
    return {
        "languages": [
            {"code": code, "name": name}
            for code, name in sorted(SUPPORTED_LANGUAGES.items(), key=lambda x: x[1])
        ],
        "total": len(SUPPORTED_LANGUAGES),
    }


# ---------------------------------------------------------------------------
# POST /transcribe — Transcribe audio chunk (20s chunks during meeting)
# ---------------------------------------------------------------------------
@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(..., description="Audio file to transcribe"),
    language: str = Form(default="auto", description="Language code or 'auto'"),
    timestamp_offset: float = Form(
        default=0.0,
        description="Offset in seconds to add to all timestamps",
    ),
    diarize: bool = Form(
        default=False,
        description="Whether to perform speaker diarization (requires HF_TOKEN)",
    ),
):
    """
    Transcribe an audio chunk with word-level timestamps.
    
    Optimized for short audio segments (~20 seconds) sent during live meetings.
    Use timestamp_offset to align chunks in the meeting timeline.
    """
    if not transcriber.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="WhisperX model not loaded. Service is still initializing.",
        )

    # Validate file
    is_valid, error = validate_audio_file(file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    temp_path = None
    try:
        # Save uploaded file
        temp_path = await save_upload_to_temp(file, file.filename)

        start_time = time.time()

        # Transcribe
        result, audio = transcriber.transcribe(
            audio_path=temp_path,
            language=language if language != "auto" else None,
        )

        # Get detected language
        detected_language = result.get("language", language if language != "auto" else "en")

        # Align for word-level timestamps
        aligned = transcriber.align(result, audio, detected_language)

        # Format output
        output = transcriber.format_result(
            aligned,
            detected_language=detected_language,
            timestamp_offset=timestamp_offset,
        )

        elapsed = time.time() - start_time
        logger.info(
            f"Transcribe complete: {len(output['segments'])} segments, "
            f"language={detected_language}, offset={timestamp_offset}s, "
            f"time={elapsed:.2f}s"
        )

        return output

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        cleanup_temp_file(temp_path)


# ---------------------------------------------------------------------------
# POST /transcribe-file — Transcribe full recording file (post-meeting)
# ---------------------------------------------------------------------------
@app.post("/transcribe-file")
async def transcribe_file(
    file: UploadFile = File(..., description="Full audio file to transcribe"),
    language: str = Form(default="auto", description="Language code or 'auto'"),
):
    """
    Transcribe a complete audio file with word-level timestamps.
    
    Optimized for larger files (full meeting individual audio tracks).
    Uses higher batch_size for better throughput.
    No timestamp_offset — starts from 0.
    """
    if not transcriber.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="WhisperX model not loaded. Service is still initializing.",
        )

    # Validate file
    is_valid, error = validate_audio_file(file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    temp_path = None
    try:
        # Save uploaded file
        temp_path = await save_upload_to_temp(file, file.filename)

        start_time = time.time()

        # Use higher batch size for full file processing
        full_file_batch_size = max(transcriber.batch_size, 8)

        # Transcribe with higher batch size
        result, audio = transcriber.transcribe(
            audio_path=temp_path,
            language=language if language != "auto" else None,
            batch_size=full_file_batch_size,
        )

        # Get detected language
        detected_language = result.get("language", language if language != "auto" else "en")

        # Align for word-level timestamps
        aligned = transcriber.align(result, audio, detected_language)

        # Format output (no timestamp offset)
        output = transcriber.format_result(
            aligned,
            detected_language=detected_language,
            timestamp_offset=0.0,
        )

        elapsed = time.time() - start_time
        logger.info(
            f"Full file transcription complete: {len(output['segments'])} segments, "
            f"language={detected_language}, time={elapsed:.2f}s"
        )

        return output

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Full file transcription error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Transcription failed: {str(e)}"
        )
    finally:
        cleanup_temp_file(temp_path)


# ---------------------------------------------------------------------------
# Root endpoint
# ---------------------------------------------------------------------------
@app.get("/")
async def root():
    """Root endpoint — service info."""
    return {
        "service": "SpeakInsights WhisperX Service",
        "version": "3.0.0",
        "status": "running",
        "model_loaded": transcriber.is_loaded,
        "endpoints": {
            "health": "GET /health",
            "transcribe": "POST /transcribe",
            "transcribe_file": "POST /transcribe-file",
            "languages": "GET /languages",
        },
    }
