#!/usr/bin/env bash
# =============================================================================
# SpeakInsights v3 — Windows Setup Script (WSL2 / Git Bash)
# =============================================================================
# Prerequisites: Docker Desktop with WSL2 backend, NVIDIA Container Toolkit
# This script sets up everything needed to run SpeakInsights on Windows with
# NVIDIA GPU acceleration for both Ollama and WhisperX.
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error()   { echo -e "${RED}✗ $1${NC}"; }
print_info()    { echo -e "${CYAN}→ $1${NC}"; }

# Get script directory (project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

print_header "SpeakInsights v3 — Windows Setup"

# ─────────────────────────────────────────────────────────────
# Step 1: Check Docker Desktop with WSL2
# ─────────────────────────────────────────────────────────────
print_info "Checking Docker Desktop..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed."
    echo "  Install Docker Desktop from: https://www.docker.com/products/docker-desktop/"
    echo "  Ensure WSL2 backend is enabled in Docker Desktop settings."
    exit 1
fi

if ! docker info &> /dev/null; then
    print_error "Docker Desktop is not running. Please start it first."
    exit 1
fi

print_success "Docker Desktop is installed and running"

# ─────────────────────────────────────────────────────────────
# Step 2: Check NVIDIA Container Toolkit
# ─────────────────────────────────────────────────────────────
print_info "Checking NVIDIA Container Toolkit..."
if docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi > /dev/null 2>&1; then
    print_success "NVIDIA Container Toolkit is working"
else
    print_warning "NVIDIA GPU access not detected."
    echo "  Install NVIDIA Container Toolkit:"
    echo "  https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html"
    echo ""
    echo "  Continuing without GPU — Ollama and WhisperX will use CPU (slower)."
fi

# ─────────────────────────────────────────────────────────────
# Step 3: Create Storage Directories
# ─────────────────────────────────────────────────────────────
print_info "Creating storage directories..."
mkdir -p storage/recordings storage/exports storage/temp
print_success "Storage directories created"

# ─────────────────────────────────────────────────────────────
# Step 4: Setup Environment File
# ─────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
    print_info "Creating .env from .env.example..."
    cp .env.example .env
    # Override Ollama URL for Windows (Ollama runs in Docker)
    sed -i 's|OLLAMA_URL=http://host.docker.internal:11434|OLLAMA_URL=http://ollama:11434|' .env
    print_success ".env file created (Ollama URL set to Docker container)"
else
    print_warning ".env already exists — skipping (delete it to regenerate)"
    print_info "Ensure OLLAMA_URL=http://ollama:11434 is set in .env"
fi

# ─────────────────────────────────────────────────────────────
# Step 5: Build and Start Docker Services (with Windows override)
# ─────────────────────────────────────────────────────────────
print_info "Building and starting Docker services with NVIDIA GPU support..."
docker compose -f docker-compose.yml -f docker-compose.windows.yml up --build -d

# ─────────────────────────────────────────────────────────────
# Step 6: Wait for Ollama Init to Pull Models
# ─────────────────────────────────────────────────────────────
print_info "Waiting for Ollama to start and pull models..."
echo "  This may take several minutes on first run..."

echo -n "  Ollama: "
for i in {1..60}; do
    if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}ready${NC}"
        break
    fi
    echo -n "."
    sleep 3
done

# Wait for model pull init container to complete
echo -n "  Model pull: "
for i in {1..120}; do
    STATUS=$(docker inspect --format='{{.State.Status}}' speakinsights-ollama-init 2>/dev/null || echo "unknown")
    if [ "$STATUS" = "exited" ]; then
        EXIT_CODE=$(docker inspect --format='{{.State.ExitCode}}' speakinsights-ollama-init 2>/dev/null || echo "1")
        if [ "$EXIT_CODE" = "0" ]; then
            echo -e "${GREEN}complete${NC}"
        else
            echo -e "${YELLOW}completed with warnings${NC}"
        fi
        break
    fi
    echo -n "."
    sleep 5
done

# ─────────────────────────────────────────────────────────────
# Step 7: Wait for Other Health Checks
# ─────────────────────────────────────────────────────────────
print_info "Waiting for services to become healthy..."

echo -n "  PostgreSQL: "
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U postgres -d speakinsights > /dev/null 2>&1; then
        echo -e "${GREEN}ready${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

echo -n "  Redis: "
for i in {1..20}; do
    if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}ready${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

echo -n "  Backend: "
for i in {1..30}; do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}ready${NC}"
        break
    fi
    echo -n "."
    sleep 3
done

echo -n "  Frontend: "
for i in {1..20}; do
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}ready${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# ─────────────────────────────────────────────────────────────
# Done!
# ─────────────────────────────────────────────────────────────
print_header "SpeakInsights v3 — Setup Complete!"

echo -e "${GREEN}All services are running!${NC}\n"
echo -e "  ${CYAN}Frontend:${NC}   http://localhost:3000"
echo -e "  ${CYAN}Backend:${NC}    http://localhost:8000"
echo -e "  ${CYAN}API Docs:${NC}   http://localhost:8000/docs"
echo -e "  ${CYAN}LiveKit:${NC}    ws://localhost:7880"
echo -e "  ${CYAN}WhisperX:${NC}   http://localhost:9000"
echo -e "  ${CYAN}PostgreSQL:${NC} localhost:5432"
echo -e "  ${CYAN}Redis:${NC}      localhost:6379"
echo -e "  ${CYAN}Ollama:${NC}     http://localhost:11434 (Docker)\n"

echo -e "  ${YELLOW}To stop:${NC}  docker compose -f docker-compose.yml -f docker-compose.windows.yml down"
echo -e "  ${YELLOW}Logs:${NC}     docker compose -f docker-compose.yml -f docker-compose.windows.yml logs -f"
echo -e "  ${YELLOW}Restart:${NC}  docker compose -f docker-compose.yml -f docker-compose.windows.yml restart\n"
