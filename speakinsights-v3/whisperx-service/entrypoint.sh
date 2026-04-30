#!/bin/bash
# =============================================================================
# SpeakInsights WhisperX — Entrypoint Script
# =============================================================================
# Ensures the WhisperX model is downloaded before starting the service.
# On first start (empty volume), this downloads the model weights.
# On subsequent starts, the cached model is verified quickly (~2s).
# =============================================================================

set -e

MODEL_SIZE="${MODEL_SIZE:-small}"
DEVICE="${DEVICE:-cpu}"
COMPUTE_TYPE="${COMPUTE_TYPE:-int8}"

echo "=================================================="
echo "  SpeakInsights WhisperX Service — Entrypoint"
echo "  Model: ${MODEL_SIZE} | Device: ${DEVICE}"
echo "=================================================="

# Pre-load/verify the model before starting uvicorn
echo "[entrypoint] Checking WhisperX model cache..."
python -m scripts.preload_model "${MODEL_SIZE}"

echo "[entrypoint] Model ready — starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 9000 --workers 1
