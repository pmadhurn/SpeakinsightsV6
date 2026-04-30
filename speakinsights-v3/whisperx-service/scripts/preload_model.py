"""
Pre-download WhisperX model weights so they're ready when the service starts.

This script is used in two contexts:
  1. During `docker build` — bakes the default model into the image layer.
  2. At container startup (entrypoint) — ensures the model is present in
     the volume cache, downloading it if the user changed MODEL_SIZE.

Usage:
    python -m scripts.preload_model [model_size]

If model_size is not specified, defaults to the MODEL_SIZE env var or "small".
"""

import logging
import os
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | preload | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("preload")


def preload_model(model_size: str, device: str = "cpu", compute_type: str = "int8"):
    """Download and cache the WhisperX model if not already present."""
    import whisperx

    logger.info("=" * 60)
    logger.info(f"Pre-loading WhisperX model: {model_size}")
    logger.info(f"  Device      : {device}")
    logger.info(f"  Compute type: {compute_type}")
    logger.info("=" * 60)

    start = time.time()

    try:
        model = whisperx.load_model(
            model_size,
            device=device,
            compute_type=compute_type,
            language=None,
        )
        elapsed = time.time() - start
        logger.info(f"✓ Model '{model_size}' loaded/verified in {elapsed:.1f}s")

        # Release memory — we only needed to trigger the download
        del model
        if device == "cpu":
            import gc
            gc.collect()
        else:
            import torch
            torch.cuda.empty_cache()

        logger.info("✓ Model cache is ready. Memory released.")

    except Exception as e:
        logger.error(f"✗ Failed to pre-load model '{model_size}': {e}")
        # Don't crash the build — the model will be downloaded at runtime
        logger.warning("The model will be downloaded on first startup instead.")


def preload_alignment_model(language: str = "en", device: str = "cpu"):
    """Pre-download the alignment model for the most common language."""
    import whisperx

    logger.info(f"Pre-loading alignment model for language: {language}")
    start = time.time()

    try:
        model_a, metadata = whisperx.load_align_model(
            language_code=language,
            device=device,
        )
        elapsed = time.time() - start
        logger.info(f"✓ Alignment model for '{language}' loaded in {elapsed:.1f}s")
        del model_a, metadata
    except Exception as e:
        logger.warning(f"Could not pre-load alignment model for '{language}': {e}")


if __name__ == "__main__":
    model_size = (
        sys.argv[1]
        if len(sys.argv) > 1
        else os.getenv("MODEL_SIZE", "small")
    )
    device = os.getenv("DEVICE", "cpu")
    compute_type = os.getenv("COMPUTE_TYPE", "int8")

    preload_model(model_size, device, compute_type)

    # Also pre-load English alignment model (most common)
    preload_alignment_model("en", device)

    logger.info("Pre-load complete.")
