#!/usr/bin/env bash
# =============================================================================
# SpeakInsights v3 — Mac Setup Script
# =============================================================================
# Prerequisites: Docker Desktop for Mac, Homebrew
# This script sets up everything needed to run SpeakInsights on macOS with
# Apple Silicon (M-series) using native Ollama for Metal GPU acceleration.
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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

print_header "SpeakInsights v3 — Mac Setup"

# ─────────────────────────────────────────────────────────────
# Step 1: Check Docker Desktop
# ─────────────────────────────────────────────────────────────
print_info "Checking Docker Desktop..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed."
    echo "  Install Docker Desktop from: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

if ! docker info &> /dev/null; then
    print_error "Docker Desktop is not running. Please start it first."
    exit 1
fi

print_success "Docker Desktop is installed and running"

# ─────────────────────────────────────────────────────────────
# Step 2: Check & Install Ollama
# ─────────────────────────────────────────────────────────────
print_info "Checking Ollama..."
if ! command -v ollama &> /dev/null; then
    print_warning "Ollama is not installed. Installing via Homebrew..."
    if ! command -v brew &> /dev/null; then
        print_error "Homebrew is not installed. Install it from: https://brew.sh"
        exit 1
    fi
    brew install ollama
    print_success "Ollama installed via Homebrew"
else
    print_success "Ollama is already installed"
fi

# Ensure Ollama is running
if ! curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
    print_info "Starting Ollama service..."
    ollama serve &
    sleep 3
    if ! curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
        print_warning "Ollama may not be fully started yet. Continuing..."
    fi
fi

# ─────────────────────────────────────────────────────────────
# Step 3: Pull Ollama Models
# ─────────────────────────────────────────────────────────────
print_info "Pulling Ollama models (this may take a few minutes)..."

echo "  Pulling llama3.2:3b (summarization & chat)..."
ollama pull llama3.2:3b
print_success "llama3.2:3b pulled"

echo "  Pulling nomic-embed-text (RAG embeddings)..."
ollama pull nomic-embed-text
print_success "nomic-embed-text pulled"

# ─────────────────────────────────────────────────────────────
# Step 4: Create Storage Directories
# ─────────────────────────────────────────────────────────────
print_info "Creating storage directories..."
mkdir -p storage/recordings storage/exports storage/temp
print_success "Storage directories created"

# ─────────────────────────────────────────────────────────────
# Step 5: Setup Environment File
# ─────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
    print_info "Creating .env from .env.example..."
    cp .env.example .env
    print_success ".env file created"
else
    print_warning ".env already exists — skipping (delete it to regenerate)"
fi

# ─────────────────────────────────────────────────────────────
# Step 6: Build and Start Docker Services
# ─────────────────────────────────────────────────────────────
print_info "Building and starting Docker services..."
docker compose up --build -d

# ─────────────────────────────────────────────────────────────
# Step 7: Wait for Health Checks
# ─────────────────────────────────────────────────────────────
print_info "Waiting for services to become healthy..."

# Wait for PostgreSQL
echo -n "  PostgreSQL: "
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U postgres -d speakinsights > /dev/null 2>&1; then
        echo -e "${GREEN}ready${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for Redis
echo -n "  Redis: "
for i in {1..20}; do
    if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}ready${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for Backend
echo -n "  Backend: "
for i in {1..30}; do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}ready${NC}"
        break
    fi
    echo -n "."
    sleep 3
done

# Wait for Frontend
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
echo -e "  ${CYAN}Ollama:${NC}     http://localhost:11434 (native)\n"

echo -e "  ${YELLOW}To stop:${NC}  docker compose down"
echo -e "  ${YELLOW}Logs:${NC}     docker compose logs -f"
echo -e "  ${YELLOW}Restart:${NC}  docker compose restart\n"
