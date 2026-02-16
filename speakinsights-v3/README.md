# SpeakInsights v3

A Docker-deployable multi-person meeting platform with real-time video conferencing (up to 20 participants), live captions, WhisperX-powered transcription with speaker attribution, post-meeting AI summarization and task extraction via Ollama, sentiment analysis, RAG-powered chat, Google Calendar .ics export, meeting recording with playback, and a modern glassmorphism "Frosted Aurora" UI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (React + Vite)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │  Meeting  │  │   Chat   │  │ History  │  │  Live Captions     │  │
│  │   Room    │  │  (RAG)   │  │ Review   │  │  (Web Speech API)  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────────────────┘  │
│       │              │             │                                  │
└───────┼──────────────┼─────────────┼────────────────────────────────┘
        │ WebSocket    │ REST        │ REST
        │ + WebRTC     │             │
┌───────┼──────────────┼─────────────┼────────────────────────────────┐
│       ▼              ▼             ▼          Docker Network         │
│  ┌─────────────────────────────────────┐                             │
│  │      FastAPI Backend (:8000)        │                             │
│  │  WebSocket handlers + REST API      │                             │
│  └──┬──────┬──────┬──────┬─────────────┘                             │
│     │      │      │      │                                           │
│     ▼      ▼      ▼      ▼                                           │
│  ┌──────┐ ┌────┐ ┌─────────┐ ┌──────────┐                           │
│  │Postgr│ │Red-│ │LiveKit  │ │WhisperX  │                           │
│  │SQL 16│ │is 7│ │Server   │ │Service   │                           │
│  │+pgvec│ │    │ │(:7880)  │ │(:9000)   │                           │
│  │(:5432│ │(:63│ │         │ │          │                           │
│  │)     │ │79) │ │ Egress  │ │ small    │                           │
│  └──────┘ └────┘ │ Service │ │ model    │                           │
│                   └─────────┘ └──────────┘                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
        │
        │ (Mac: host.docker.internal / Windows: Docker container)
        ▼
   ┌──────────┐
   │  Ollama   │
   │ LLM      │
   │ (:11434) │
   └──────────┘
```

---

## Prerequisites

### Mac (Apple Silicon)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Rosetta enabled for x86 images)
- [Homebrew](https://brew.sh)
- [Ollama](https://ollama.ai) (installed natively for Metal GPU acceleration)

### Windows
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (WSL2 backend)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
- NVIDIA GPU with updated drivers

---

## Quick Start

### Mac (3 commands)

```bash
# 1. Clone and enter the project
git clone <repo-url> && cd speakinsights-v3

# 2. Make setup script executable
chmod +x scripts/setup-mac.sh

# 3. Run setup (installs Ollama, pulls models, starts Docker)
./scripts/setup-mac.sh
```

### Windows (3 commands)

**PowerShell:**
```powershell
# 1. Clone and enter the project
git clone <repo-url>; cd speakinsights-v3

# 2. Run setup script
.\scripts\setup-windows.ps1
```

**WSL2 / Git Bash:**
```bash
# 1. Clone and enter the project
git clone <repo-url> && cd speakinsights-v3

# 2. Make setup script executable
chmod +x scripts/setup-windows.sh

# 3. Run setup
./scripts/setup-windows.sh
```

---

## Services & Ports

| Service       | URL / Address              | Description                          |
|---------------|----------------------------|--------------------------------------|
| Frontend      | http://localhost:3000       | React UI (Nginx)                     |
| Backend API   | http://localhost:8000       | FastAPI REST + WebSocket             |
| API Docs      | http://localhost:8000/docs  | Swagger / OpenAPI documentation      |
| LiveKit       | ws://localhost:7880         | WebRTC SFU server                    |
| LiveKit RTC   | :7881 (TCP), :7882 (UDP)   | WebRTC media transport               |
| WhisperX      | http://localhost:9000       | Transcription service                |
| PostgreSQL    | localhost:5432              | Database (pgvector enabled)          |
| Redis         | localhost:6379              | Cache & message queue                |
| Ollama        | http://localhost:11434      | LLM inference (native Mac / Docker)  |

---

## Environment Variables

| Variable             | Default                                  | Description                                  |
|----------------------|------------------------------------------|----------------------------------------------|
| `LIVEKIT_API_KEY`    | `devkey`                                 | LiveKit authentication key                   |
| `LIVEKIT_API_SECRET` | `devsecret1234567890`                    | LiveKit authentication secret                |
| `POSTGRES_PASSWORD`  | `speakinsights`                          | PostgreSQL password                          |
| `HF_TOKEN`           | *(empty)*                                | HuggingFace token (WhisperX diarization)     |
| `OLLAMA_URL`         | `http://host.docker.internal:11434`      | Ollama API endpoint                          |
| `OLLAMA_MODEL`       | `llama3.2:3b`                            | Default model for summarization & chat       |
| `WHISPERX_MODEL`     | `small`                                  | WhisperX ASR model size                      |
| `DEFAULT_LANGUAGE`   | `auto`                                   | Default transcription language               |
| `CORS_ORIGINS`       | `http://localhost:3000,...`               | Allowed CORS origins                         |

---

## Tech Stack

| Layer           | Technology                                      |
|-----------------|--------------------------------------------------|
| Frontend        | React 18 + TypeScript + Vite + TailwindCSS 4     |
| State Mgmt      | Zustand                                          |
| Backend         | FastAPI (Python 3.11) + SQLAlchemy (async)        |
| Migrations      | Alembic                                           |
| WebRTC          | LiveKit (self-hosted, open source)                |
| Transcription   | WhisperX (self-hosted, "small" model)             |
| Live Captions   | Browser Web Speech API (client-side, English)     |
| LLM             | Ollama (llama3.2:3b / llama3.1:8b)               |
| Embeddings      | nomic-embed-text (via Ollama)                     |
| Sentiment       | VADER (in-meeting) + Ollama (post-meeting)        |
| Database        | PostgreSQL 16 + pgvector                          |
| Cache           | Redis 7                                           |
| Recording       | LiveKit Egress                                    |
| Calendar        | .ics file generation                              |
| Containerization| Docker Compose                                    |

---

## Project Structure

```
speakinsights-v3/
├── docker-compose.yml              # Main Docker Compose (Mac default)
├── docker-compose.windows.yml      # Windows NVIDIA GPU override
├── livekit.yaml                    # LiveKit server configuration
├── .env.example                    # Environment variables template
│
├── backend/                        # FastAPI backend
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   └── app/
│       ├── main.py                 # FastAPI app entry
│       ├── config.py               # Settings & configuration
│       ├── api/                    # REST API routes
│       ├── core/                   # Business logic services
│       ├── db/                     # Database connection
│       ├── models/                 # SQLAlchemy models
│       ├── schemas/                # Pydantic schemas
│       └── websockets/             # WebSocket handlers
│
├── frontend/                       # React + Vite frontend
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── src/
│       ├── App.tsx                 # Main app component
│       ├── components/             # UI components
│       ├── hooks/                  # Custom React hooks
│       ├── pages/                  # Page components
│       ├── services/               # API service layer
│       ├── stores/                 # Zustand stores
│       ├── types/                  # TypeScript types
│       └── utils/                  # Utilities
│
├── whisperx-service/               # WhisperX transcription
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── transcriber.py
│       └── audio_processor.py
│
├── scripts/                        # Setup & utility scripts
│   ├── setup-mac.sh
│   ├── setup-windows.sh
│   ├── setup-windows.ps1
│   ├── init-db.sql
│   └── demo-data.py
│
├── storage/                        # Persistent file storage
│   ├── recordings/                 # Meeting recordings
│   ├── exports/                    # .ics files, transcripts
│   └── temp/                       # Processing temp files
│
├── nginx/                          # Nginx reverse proxy config
│   └── nginx.conf
│
└── dta/                            # Design & specification docs
    ├── s0.md                       # Project spec & architecture
    ├── s1.md - s14.md              # Implementation specs
    ├── trbdsht.md                  # Troubleshooting guide
    └── usage.md                    # Usage documentation
```

---

## Troubleshooting

### Docker Issues

**"Cannot connect to Docker daemon"**
- Ensure Docker Desktop is running
- On Mac: check the Docker icon in the menu bar
- On Windows: check Docker Desktop in the system tray

**"Port already in use"**
- Stop other services using the same ports
- `lsof -i :3000` (Mac) or `netstat -ano | findstr :3000` (Windows)

### Ollama Issues

**"Cannot connect to Ollama" (Mac)**
- Ensure Ollama is running: `ollama serve`
- Check: `curl http://localhost:11434/api/tags`
- Docker must have "Allow host networking" enabled in Docker Desktop settings

**"Model not found"**
- Pull models manually: `ollama pull llama3.2:3b && ollama pull nomic-embed-text`

### WhisperX Issues

**"Out of memory"**
- Reduce `WHISPERX_MODEL` to `base` or `tiny` in `.env`
- Reduce `BATCH_SIZE` to `2` in docker-compose.yml

### Database Issues

**"Database connection refused"**
- Wait for PostgreSQL health check to pass
- Check logs: `docker compose logs postgres`
- Reset: `docker compose down -v && docker compose up -d`

---

## Commands Reference

```bash
# Start all services
docker compose up -d

# Start with build
docker compose up --build -d

# Stop all services
docker compose down

# Stop and remove volumes (reset data)
docker compose down -v

# View logs
docker compose logs -f
docker compose logs -f backend    # specific service

# Restart a service
docker compose restart backend

# Enter a container
docker compose exec backend bash

# Windows with GPU
docker compose -f docker-compose.yml -f docker-compose.windows.yml up --build -d
```

---

## License

MIT
