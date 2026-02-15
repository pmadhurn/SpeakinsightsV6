#powershell -ExecutionPolicy Bypass -File create-structure.ps1

# ================================================
# SpeakInsights v3 — Directory & File Creator
# Windows PowerShell Version
# ================================================

$PROJECT = "speakinsights-v3"

Write-Host "🚀 Creating SpeakInsights v3 project structure..." -ForegroundColor Cyan
Write-Host ""

New-Item -ItemType Directory -Force -Path $PROJECT | Out-Null
Set-Location $PROJECT

# =====================
# FUNCTION TO CREATE FILE
# =====================
function Touch($path) {
    $dir = Split-Path $path -Parent
    if ($dir -and !(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    if (!(Test-Path $path)) {
        New-Item -ItemType File -Force -Path $path | Out-Null
    }
}

# =====================
# ROOT FILES
# =====================
$rootFiles = @(
    "docker-compose.yml",
    "docker-compose.windows.yml",
    "livekit.yaml",
    ".env.example",
    ".env",
    ".gitignore",
    "README.md",
    "DEPLOYMENT.md",
    "DEMO_SCRIPT.md"
)
foreach ($f in $rootFiles) { Touch $f }

# =====================
# STORAGE
# =====================
$storageFiles = @(
    "storage/recordings/.gitkeep",
    "storage/exports/.gitkeep",
    "storage/temp/.gitkeep"
)
foreach ($f in $storageFiles) { Touch $f }

# =====================
# SCRIPTS
# =====================
$scriptFiles = @(
    "scripts/init-db.sql",
    "scripts/setup-mac.sh",
    "scripts/setup-windows.sh",
    "scripts/setup-windows.ps1",
    "scripts/cloudflare-tunnel.sh",
    "scripts/demo-data.py"
)
foreach ($f in $scriptFiles) { Touch $f }

# =====================
# NGINX
# =====================
Touch "nginx/nginx.conf"

# =====================
# WHISPERX SERVICE
# =====================
$whisperxFiles = @(
    "whisperx-service/Dockerfile",
    "whisperx-service/Dockerfile.cuda",
    "whisperx-service/requirements.txt",
    "whisperx-service/app/__init__.py",
    "whisperx-service/app/main.py",
    "whisperx-service/app/transcriber.py",
    "whisperx-service/app/audio_processor.py"
)
foreach ($f in $whisperxFiles) { Touch $f }

# =====================
# BACKEND
# =====================
$backendFiles = @(
    "backend/Dockerfile",
    "backend/requirements.txt",
    "backend/alembic.ini",
    "backend/app/__init__.py",
    "backend/app/main.py",
    "backend/app/config.py",
    "backend/app/db/__init__.py",
    "backend/app/db/database.py",
    "backend/app/models/__init__.py",
    "backend/app/models/meeting.py",
    "backend/app/models/participant.py",
    "backend/app/models/transcription.py",
    "backend/app/models/recording.py",
    "backend/app/models/summary.py",
    "backend/app/models/task.py",
    "backend/app/models/embedding.py",
    "backend/app/models/chat.py",
    "backend/app/models/calendar_export.py",
    "backend/app/schemas/__init__.py",
    "backend/app/schemas/meeting.py",
    "backend/app/schemas/transcription.py",
    "backend/app/schemas/summary.py",
    "backend/app/schemas/chat.py",
    "backend/app/schemas/models.py",
    "backend/app/schemas/calendar.py",
    "backend/app/core/__init__.py",
    "backend/app/core/livekit_service.py",
    "backend/app/core/whisperx_client.py",
    "backend/app/core/ollama_client.py",
    "backend/app/core/sentiment_service.py",
    "backend/app/core/calendar_generator.py",
    "backend/app/core/recording_manager.py",
    "backend/app/core/post_processing.py",
    "backend/app/api/__init__.py",
    "backend/app/api/deps.py",
    "backend/app/api/routes/__init__.py",
    "backend/app/api/routes/health.py",
    "backend/app/api/routes/meetings.py",
    "backend/app/api/routes/transcriptions.py",
    "backend/app/api/routes/summaries.py",
    "backend/app/api/routes/recordings.py",
    "backend/app/api/routes/calendar.py",
    "backend/app/api/routes/chat.py",
    "backend/app/api/routes/models.py",
    "backend/app/websockets/__init__.py",
    "backend/app/websockets/router.py",
    "backend/app/websockets/lobby_ws.py",
    "backend/app/websockets/transcript_ws.py",
    "backend/app/websockets/meeting_ws.py"
)
foreach ($f in $backendFiles) { Touch $f }

# =====================
# FRONTEND
# =====================
$frontendFiles = @(
    "frontend/Dockerfile",
    "frontend/nginx.conf",
    "frontend/package.json",
    "frontend/tsconfig.json",
    "frontend/tsconfig.node.json",
    "frontend/vite.config.ts",
    "frontend/tailwind.config.ts",
    "frontend/postcss.config.js",
    "frontend/index.html",
    "frontend/public/favicon.svg",
    "frontend/public/logo.svg",
    "frontend/src/main.tsx",
    "frontend/src/App.tsx",
    "frontend/src/index.css",
    "frontend/src/vite-env.d.ts",
    "frontend/src/types/meeting.ts",
    "frontend/src/types/transcription.ts",
    "frontend/src/types/summary.ts",
    "frontend/src/types/chat.ts",
    "frontend/src/services/api.ts",
    "frontend/src/stores/meetingStore.ts",
    "frontend/src/stores/transcriptStore.ts",
    "frontend/src/stores/uiStore.ts",
    "frontend/src/utils/formatTime.ts",
    "frontend/src/utils/colors.ts",
    "frontend/src/hooks/useWebSocket.ts",
    "frontend/src/hooks/useLobby.ts",
    "frontend/src/hooks/useMeeting.ts",
    "frontend/src/hooks/useRecording.ts",
    "frontend/src/hooks/useTranscription.ts",
    "frontend/src/hooks/useAudioChunking.ts",
    "frontend/src/hooks/useLiveCaptions.ts",
    "frontend/src/hooks/useChatStream.ts",
    "frontend/src/components/ui/GlassCard.tsx",
    "frontend/src/components/ui/GlassButton.tsx",
    "frontend/src/components/ui/GlassInput.tsx",
    "frontend/src/components/ui/GlassModal.tsx",
    "frontend/src/components/ui/GlassSidebar.tsx",
    "frontend/src/components/ui/GlassNavbar.tsx",
    "frontend/src/components/ui/Avatar.tsx",
    "frontend/src/components/ui/Badge.tsx",
    "frontend/src/components/ui/Loader.tsx",
    "frontend/src/components/ui/Toast.tsx",
    "frontend/src/components/ui/ProcessingStatus.tsx",
    "frontend/src/components/meeting/VideoGrid.tsx",
    "frontend/src/components/meeting/VideoTile.tsx",
    "frontend/src/components/meeting/MeetingControls.tsx",
    "frontend/src/components/meeting/LiveTranscript.tsx",
    "frontend/src/components/meeting/ParticipantList.tsx",
    "frontend/src/components/meeting/ChatPanel.tsx",
    "frontend/src/components/meeting/CaptionOverlay.tsx",
    "frontend/src/components/meeting/ScreenShareView.tsx",
    "frontend/src/components/meeting/LobbyNotification.tsx",
    "frontend/src/components/transcription/TranscriptViewer.tsx",
    "frontend/src/components/transcription/TranscriptSegment.tsx",
    "frontend/src/components/summary/SummaryCard.tsx",
    "frontend/src/components/summary/TaskList.tsx",
    "frontend/src/components/summary/SentimentChart.tsx",
    "frontend/src/components/history/MeetingCard.tsx",
    "frontend/src/components/history/MeetingTimeline.tsx",
    "frontend/src/components/chat/ChatMessage.tsx",
    "frontend/src/components/chat/SourceCard.tsx",
    "frontend/src/pages/Landing.tsx",
    "frontend/src/pages/CreateMeeting.tsx",
    "frontend/src/pages/JoinMeeting.tsx",
    "frontend/src/pages/MeetingRoom.tsx",
    "frontend/src/pages/History.tsx",
    "frontend/src/pages/MeetingReview.tsx",
    "frontend/src/pages/AIChat.tsx",
    "frontend/src/pages/ModelManager.tsx",
    "frontend/src/pages/Settings.tsx"
)
foreach ($f in $frontendFiles) { Touch $f }

# =====================
# WRITE .gitignore
# =====================
@"
# Dependencies
node_modules/
__pycache__/
*.pyc
.venv/
venv/

# Environment
.env
.env.local

# Build
frontend/dist/
frontend/build/
*.egg-info/

# Storage
storage/recordings/*
storage/exports/*
storage/temp/*
!storage/**/.gitkeep

# Docker
*.log

# IDE
.vscode/
.idea/
*.swp
.DS_Store

# Models
*.bin
*.pt
*.onnx
"@ | Set-Content .gitignore

# =====================
# COUNT
# =====================
$fileCount = (Get-ChildItem -Recurse -File).Count
$dirCount = (Get-ChildItem -Recurse -Directory).Count

Write-Host ""
Write-Host "✅ SpeakInsights v3 structure created!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 File count:" -ForegroundColor Yellow
Write-Host "   Total files: $fileCount"
Write-Host "   Total directories: $dirCount"
Write-Host ""
Write-Host "📁 Project location: $(Get-Location)" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Open this folder in your code editor"
Write-Host "   2. Start filling in code using the Section prompts"
Write-Host "   3. Begin with Section 0 + Section 1 (Docker infrastructure)"
Write-Host ""
Write-Host "🎯 Good luck with your semester project!" -ForegroundColor Magenta