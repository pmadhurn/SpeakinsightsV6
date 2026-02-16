# =============================================================================
# SpeakInsights v3 — WhisperX Service Dockerfile (CPU / ARM64 Mac)
# =============================================================================
# This is the CPU/ARM64 version for Mac. For Windows NVIDIA GPU, use Dockerfile.cuda.
# =============================================================================

FROM python:3.11-slim-bookworm

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    build-essential \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better layer caching
COPY requirements.txt .

# Upgrade pip for better dependency resolution
RUN pip install --no-cache-dir --upgrade pip

# Install PyTorch CPU first (for ARM64 Mac)
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install other dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install whisperx WITHOUT its dependencies (we already have what we need,
# and pyannote-audio's torchcodec doesn't have ARM64 wheels)
RUN pip install --no-cache-dir --no-deps git+https://github.com/m-bain/whisperx.git

# Install pyannote packages (--no-deps to avoid torchcodec which lacks ARM64 wheels)
# whisperx imports pyannote at module level even though we don't use diarization
RUN pip install --no-cache-dir --no-deps \
    pyannote-audio \
    pyannote-core \
    pyannote-database \
    pyannote-metrics \
    pyannote-pipeline

# Copy application source
COPY app/ ./app/

# Expose the service port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:9000/health')" || exit 1

# Run the service
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000", "--workers", "1"]
