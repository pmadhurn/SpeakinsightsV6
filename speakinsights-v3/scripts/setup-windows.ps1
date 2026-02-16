# =============================================================================
# SpeakInsights v3 — Windows Setup Script (PowerShell)
# =============================================================================
# Prerequisites: Docker Desktop with WSL2 backend, NVIDIA Container Toolkit
# Usage: .\scripts\setup-windows.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# Colors via Write-Host
function Write-Header($msg) {
    Write-Host ""
    Write-Host ("=" * 64) -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host ("=" * 64) -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[XX] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host " ->  $msg" -ForegroundColor Cyan }

# Navigate to project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
Set-Location $ProjectDir

Write-Header "SpeakInsights v3 - Windows Setup"

# -----------------------------------------------------------------------------
# Step 1: Check Docker Desktop
# -----------------------------------------------------------------------------
Write-Info "Checking Docker Desktop..."
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker not running" }
    Write-Success "Docker Desktop is installed and running"
} catch {
    Write-Err "Docker Desktop is not installed or not running."
    Write-Host "  Install from: https://www.docker.com/products/docker-desktop/"
    Write-Host "  Ensure WSL2 backend is enabled in Docker Desktop settings."
    exit 1
}

# -----------------------------------------------------------------------------
# Step 2: Check NVIDIA Container Toolkit
# -----------------------------------------------------------------------------
Write-Info "Checking NVIDIA Container Toolkit..."
try {
    $gpuTest = docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "NVIDIA Container Toolkit is working"
    } else {
        throw "GPU not accessible"
    }
} catch {
    Write-Warn "NVIDIA GPU access not detected."
    Write-Host "  Install NVIDIA Container Toolkit:"
    Write-Host "  https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html"
    Write-Host ""
    Write-Host "  Continuing without GPU - Ollama and WhisperX will use CPU (slower)."
}

# -----------------------------------------------------------------------------
# Step 3: Create Storage Directories
# -----------------------------------------------------------------------------
Write-Info "Creating storage directories..."
New-Item -ItemType Directory -Force -Path "storage/recordings" | Out-Null
New-Item -ItemType Directory -Force -Path "storage/exports" | Out-Null
New-Item -ItemType Directory -Force -Path "storage/temp" | Out-Null
Write-Success "Storage directories created"

# -----------------------------------------------------------------------------
# Step 4: Setup Environment File
# -----------------------------------------------------------------------------
if (-not (Test-Path ".env")) {
    Write-Info "Creating .env from .env.example..."
    Copy-Item ".env.example" ".env"
    # Override Ollama URL for Windows (Ollama runs in Docker)
    (Get-Content ".env") -replace `
        "OLLAMA_URL=http://host.docker.internal:11434", `
        "OLLAMA_URL=http://ollama:11434" | `
        Set-Content ".env"
    Write-Success ".env file created (Ollama URL set to Docker container)"
} else {
    Write-Warn ".env already exists - skipping (delete it to regenerate)"
    Write-Info "Ensure OLLAMA_URL=http://ollama:11434 is set in .env"
}

# -----------------------------------------------------------------------------
# Step 5: Build and Start Docker Services
# -----------------------------------------------------------------------------
Write-Info "Building and starting Docker services with NVIDIA GPU support..."
docker compose -f docker-compose.yml -f docker-compose.windows.yml up --build -d

if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to start Docker services."
    exit 1
}

# -----------------------------------------------------------------------------
# Step 6: Wait for Ollama Init to Pull Models
# -----------------------------------------------------------------------------
Write-Info "Waiting for Ollama to start and pull models..."
Write-Host "  This may take several minutes on first run..."

Write-Host -NoNewline "  Ollama: "
for ($i = 0; $i -lt 60; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "ready" -ForegroundColor Green
            break
        }
    } catch {}
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 3
}

# Wait for model pull
Write-Host -NoNewline "  Model pull: "
for ($i = 0; $i -lt 120; $i++) {
    try {
        $status = docker inspect --format='{{.State.Status}}' speakinsights-ollama-init 2>&1
        if ($status -eq "exited") {
            $exitCode = docker inspect --format='{{.State.ExitCode}}' speakinsights-ollama-init 2>&1
            if ($exitCode -eq "0") {
                Write-Host "complete" -ForegroundColor Green
            } else {
                Write-Host "completed with warnings" -ForegroundColor Yellow
            }
            break
        }
    } catch {}
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 5
}

# -----------------------------------------------------------------------------
# Step 7: Wait for Health Checks
# -----------------------------------------------------------------------------
Write-Info "Waiting for services to become healthy..."

Write-Host -NoNewline "  PostgreSQL: "
for ($i = 0; $i -lt 30; $i++) {
    $result = docker compose exec -T postgres pg_isready -U postgres -d speakinsights 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "ready" -ForegroundColor Green
        break
    }
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 2
}

Write-Host -NoNewline "  Redis: "
for ($i = 0; $i -lt 20; $i++) {
    $result = docker compose exec -T redis redis-cli ping 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "ready" -ForegroundColor Green
        break
    }
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 2
}

Write-Host -NoNewline "  Backend: "
for ($i = 0; $i -lt 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "ready" -ForegroundColor Green
            break
        }
    } catch {}
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 3
}

Write-Host -NoNewline "  Frontend: "
for ($i = 0; $i -lt 20; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "ready" -ForegroundColor Green
            break
        }
    } catch {}
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 2
}

# -----------------------------------------------------------------------------
# Done!
# -----------------------------------------------------------------------------
Write-Header "SpeakInsights v3 - Setup Complete!"

Write-Host "All services are running!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:   http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend:    http://localhost:8000" -ForegroundColor Cyan
Write-Host "  API Docs:   http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "  LiveKit:    ws://localhost:7880" -ForegroundColor Cyan
Write-Host "  WhisperX:   http://localhost:9000" -ForegroundColor Cyan
Write-Host "  PostgreSQL: localhost:5432" -ForegroundColor Cyan
Write-Host "  Redis:      localhost:6379" -ForegroundColor Cyan
Write-Host "  Ollama:     http://localhost:11434 (Docker)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To stop:  docker compose -f docker-compose.yml -f docker-compose.windows.yml down" -ForegroundColor Yellow
Write-Host "  Logs:     docker compose -f docker-compose.yml -f docker-compose.windows.yml logs -f" -ForegroundColor Yellow
Write-Host "  Restart:  docker compose -f docker-compose.yml -f docker-compose.windows.yml restart" -ForegroundColor Yellow
Write-Host ""
