#!/bin/bash

# ================================================
# SpeakInsights v3 — Directory & File Creator
# Run this ONCE to scaffold the entire project
# ================================================

PROJECT="speakinsights-v3"

echo "🚀 Creating SpeakInsights v3 project structure..."
echo ""

mkdir -p $PROJECT
cd $PROJECT

# =====================
# ROOT FILES
# =====================
touch docker-compose.yml
touch docker-compose.windows.yml
touch livekit.yaml
touch .env.example
touch .env
touch .gitignore
touch README.md
touch DEPLOYMENT.md
touch DEMO_SCRIPT.md

# =====================
# STORAGE
# =====================
mkdir -p storage/recordings
mkdir -p storage/exports
mkdir -p storage/temp
touch storage/recordings/.gitkeep
touch storage/exports/.gitkeep
touch storage/temp/.gitkeep

# =====================
# SCRIPTS
# =====================
mkdir -p scripts
touch scripts/init-db.sql
touch scripts/setup-mac.sh
touch scripts/setup-windows.sh
touch scripts/setup-windows.ps1
touch scripts/cloudflare-tunnel.sh
touch scripts/demo-data.py

# Make scripts executable
chmod +x scripts/setup-mac.sh
chmod +x scripts/setup-windows.sh
chmod +x scripts/cloudflare-tunnel.sh

# =====================
# NGINX
# =====================
mkdir -p nginx
touch nginx/nginx.conf

# =====================
# WHISPERX SERVICE
# =====================
mkdir -p whisperx-service/app
touch whisperx-service/Dockerfile
touch whisperx-service/Dockerfile.cuda
touch whisperx-service/requirements.txt
touch whisperx-service/app/__init__.py
touch whisperx-service/app/main.py
touch whisperx-service/app/transcriber.py
touch whisperx-service/app/audio_processor.py

# =====================
# BACKEND
# =====================
mkdir -p backend/app/db
mkdir -p backend/app/models
mkdir -p backend/app/schemas
mkdir -p backend/app/core
mkdir -p backend/app/api/routes
mkdir -p backend/app/websockets

touch backend/Dockerfile
touch backend/requirements.txt
touch backend/alembic.ini

# Backend app
touch backend/app/__init__.py
touch backend/app/main.py
touch backend/app/config.py

# Backend DB
touch backend/app/db/__init__.py
touch backend/app/db/database.py

# Backend Models
touch backend/app/models/__init__.py
touch backend/app/models/meeting.py
touch backend/app/models/participant.py
touch backend/app/models/transcription.py
touch backend/app/models/recording.py
touch backend/app/models/summary.py
touch backend/app/models/task.py
touch backend/app/models/embedding.py
touch backend/app/models/chat.py
touch backend/app/models/calendar_export.py

# Backend Schemas
touch backend/app/schemas/__init__.py
touch backend/app/schemas/meeting.py
touch backend/app/schemas/transcription.py
touch backend/app/schemas/summary.py
touch backend/app/schemas/chat.py
touch backend/app/schemas/models.py
touch backend/app/schemas/calendar.py

# Backend Core Services
touch backend/app/core/__init__.py
touch backend/app/core/livekit_service.py
touch backend/app/core/whisperx_client.py
touch backend/app/core/ollama_client.py
touch backend/app/core/sentiment_service.py
touch backend/app/core/calendar_generator.py
touch backend/app/core/recording_manager.py
touch backend/app/core/post_processing.py

# Backend API
touch backend/app/api/__init__.py
touch backend/app/api/deps.py
touch backend/app/api/routes/__init__.py
touch backend/app/api/routes/health.py
touch backend/app/api/routes/meetings.py
touch backend/app/api/routes/transcriptions.py
touch backend/app/api/routes/summaries.py
touch backend/app/api/routes/recordings.py
touch backend/app/api/routes/calendar.py
touch backend/app/api/routes/chat.py
touch backend/app/api/routes/models.py

# Backend WebSockets
touch backend/app/websockets/__init__.py
touch backend/app/websockets/router.py
touch backend/app/websockets/lobby_ws.py
touch backend/app/websockets/transcript_ws.py
touch backend/app/websockets/meeting_ws.py

# =====================
# FRONTEND
# =====================
mkdir -p frontend/public
mkdir -p frontend/src/types
mkdir -p frontend/src/services
mkdir -p frontend/src/stores
mkdir -p frontend/src/utils
mkdir -p frontend/src/hooks
mkdir -p frontend/src/components/ui
mkdir -p frontend/src/components/meeting
mkdir -p frontend/src/components/transcription
mkdir -p frontend/src/components/summary
mkdir -p frontend/src/components/history
mkdir -p frontend/src/components/chat
mkdir -p frontend/src/pages

# Frontend configs
touch frontend/Dockerfile
touch frontend/nginx.conf
touch frontend/package.json
touch frontend/tsconfig.json
touch frontend/tsconfig.node.json
touch frontend/vite.config.ts
touch frontend/tailwind.config.ts
touch frontend/postcss.config.js
touch frontend/index.html

# Frontend public
touch frontend/public/favicon.svg
touch frontend/public/logo.svg

# Frontend src root
touch frontend/src/main.tsx
touch frontend/src/App.tsx
touch frontend/src/index.css
touch frontend/src/vite-env.d.ts

# Frontend types
touch frontend/src/types/meeting.ts
touch frontend/src/types/transcription.ts
touch frontend/src/types/summary.ts
touch frontend/src/types/chat.ts

# Frontend services
touch frontend/src/services/api.ts

# Frontend stores
touch frontend/src/stores/meetingStore.ts
touch frontend/src/stores/transcriptStore.ts
touch frontend/src/stores/uiStore.ts

# Frontend utils
touch frontend/src/utils/formatTime.ts
touch frontend/src/utils/colors.ts

# Frontend hooks
touch frontend/src/hooks/useWebSocket.ts
touch frontend/src/hooks/useLobby.ts
touch frontend/src/hooks/useMeeting.ts
touch frontend/src/hooks/useRecording.ts
touch frontend/src/hooks/useTranscription.ts
touch frontend/src/hooks/useAudioChunking.ts
touch frontend/src/hooks/useLiveCaptions.ts
touch frontend/src/hooks/useChatStream.ts

# Frontend UI components
touch frontend/src/components/ui/GlassCard.tsx
touch frontend/src/components/ui/GlassButton.tsx
touch frontend/src/components/ui/GlassInput.tsx
touch frontend/src/components/ui/GlassModal.tsx
touch frontend/src/components/ui/GlassSidebar.tsx
touch frontend/src/components/ui/GlassNavbar.tsx
touch frontend/src/components/ui/Avatar.tsx
touch frontend/src/components/ui/Badge.tsx
touch frontend/src/components/ui/Loader.tsx
touch frontend/src/components/ui/Toast.tsx
touch frontend/src/components/ui/ProcessingStatus.tsx

# Frontend meeting components
touch frontend/src/components/meeting/VideoGrid.tsx
touch frontend/src/components/meeting/VideoTile.tsx
touch frontend/src/components/meeting/MeetingControls.tsx
touch frontend/src/components/meeting/LiveTranscript.tsx
touch frontend/src/components/meeting/ParticipantList.tsx
touch frontend/src/components/meeting/ChatPanel.tsx
touch frontend/src/components/meeting/CaptionOverlay.tsx
touch frontend/src/components/meeting/ScreenShareView.tsx
touch frontend/src/components/meeting/LobbyNotification.tsx

# Frontend transcription components
touch frontend/src/components/transcription/TranscriptViewer.tsx
touch frontend/src/components/transcription/TranscriptSegment.tsx

# Frontend summary components
touch frontend/src/components/summary/SummaryCard.tsx
touch frontend/src/components/summary/TaskList.tsx
touch frontend/src/components/summary/SentimentChart.tsx

# Frontend history components
touch frontend/src/components/history/MeetingCard.tsx
touch frontend/src/components/history/MeetingTimeline.tsx

# Frontend chat components
touch frontend/src/components/chat/ChatMessage.tsx
touch frontend/src/components/chat/SourceCard.tsx

# Frontend pages
touch frontend/src/pages/Landing.tsx
touch frontend/src/pages/CreateMeeting.tsx
touch frontend/src/pages/JoinMeeting.tsx
touch frontend/src/pages/MeetingRoom.tsx
touch frontend/src/pages/History.tsx
touch frontend/src/pages/MeetingReview.tsx
touch frontend/src/pages/AIChat.tsx
touch frontend/src/pages/ModelManager.tsx
touch frontend/src/pages/Settings.tsx

# =====================
# WRITE .gitignore
# =====================
cat > .gitignore << 'EOF'
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

# Storage (keep structure, ignore content)
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
*.swo
.DS_Store

# Models (large files)
*.bin
*.pt
*.onnx
EOF

# =====================
# COUNT FILES
# =====================
echo ""
echo "✅ SpeakInsights v3 structure created!"
echo ""
echo "📊 File count:"
find . -type f | wc -l | xargs echo "   Total files:"
find . -type d | wc -l | xargs echo "   Total directories:"
echo ""
echo "📁 Project location: $(pwd)"
echo ""
echo "📋 Next steps:"
echo "   1. Open this folder in your code editor"
echo "   2. Start filling in code using the Section prompts"
echo "   3. Begin with Section 0 + Section 1 (Docker infrastructure)"
echo ""
echo "🎯 Good luck with your semester project!"