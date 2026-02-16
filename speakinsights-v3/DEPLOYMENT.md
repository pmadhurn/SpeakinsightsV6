# SpeakInsights v3 — Deployment Guide

> Complete step-by-step deployment for MacBook Pro, Windows/NVIDIA, Hetzner VPS,
> and Cloudflare Tunnel exposure.

---

## Table of Contents
1. [A. MacBook Pro (Local Development)](#a-macbook-pro-local-development)
2. [B. Windows with NVIDIA GPU](#b-windows-with-nvidia-gpu)
3. [C. Hetzner VPS (Production)](#c-hetzner-vps-production)
4. [D. Exposing via Cloudflare Tunnel](#d-exposing-via-cloudflare-tunnel)
5. [Troubleshooting](#troubleshooting)

---

## A. MacBook Pro (Local Development)

### Prerequisites
| Tool | Version | Install |
|------|---------|---------|
| Docker Desktop | ≥ 4.25 | [docker.com](https://docker.com) |
| Ollama | latest | `brew install ollama` |
| Node.js | ≥ 18 | `brew install node` (for local frontend dev) |
| Git | ≥ 2.0 | `xcode-select --install` |

### Step 1: Clone & configure
```bash
git clone <repo-url> speakinsights-v3
cd speakinsights-v3
```

### Step 2: Start Ollama natively (Metal acceleration)
```bash
# Pull required models
ollama pull llama3.2:3b
ollama pull nomic-embed-text

# Verify Ollama is running
curl http://localhost:11434/api/tags
```

> **Why native?** Ollama on Mac uses Metal GPU acceleration, which is 3-5x
> faster than running in Docker's Linux VM on Apple Silicon.

### Step 3: Start Docker services
```bash
docker compose up -d --build
```

This starts 7 containers:
| Container | Port | Purpose |
|-----------|------|---------|
| `speakinsights-frontend` | 3000 | React app (nginx) |
| `speakinsights-backend` | 8000 | FastAPI server |
| `speakinsights-postgres` | 5432 | PostgreSQL + pgvector |
| `speakinsights-redis` | 6379 | Cache/queue |
| `speakinsights-livekit` | 7880 | WebRTC server |
| `speakinsights-egress` | — | Recording service |
| `speakinsights-whisperx` | 9000 | Transcription (CPU) |

### Step 4: Verify deployment
```bash
# Check all containers are running
docker compose ps

# Health check
curl http://localhost:8000/api/health | python3 -m json.tool

# Open the app
open http://localhost:3000
```

### Step 5: Seed demo data (optional)
```bash
pip install httpx
python scripts/demo-data.py
```

### Resource usage (typical)
- Docker containers: ~4-5 GB RAM
- Ollama (idle): ~200 MB RAM
- Ollama (during inference): ~3-4 GB RAM (llama3.2:3b)
- Total: ~8-9 GB peak (fits within 24 GB)

---

## B. Windows with NVIDIA GPU

### Prerequisites
| Tool | Version | Install |
|------|---------|---------|
| Docker Desktop | ≥ 4.25 | [docker.com](https://docker.com) (WSL 2 backend) |
| NVIDIA Driver | ≥ 525 | [nvidia.com](https://nvidia.com/drivers) |
| NVIDIA Container Toolkit | latest | [docs.nvidia.com](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/) |
| Git | ≥ 2.0 | [git-scm.com](https://git-scm.com) |

### Step 1: Enable WSL 2 & GPU passthrough
```powershell
# In PowerShell (Admin)
wsl --install
wsl --update

# Verify NVIDIA GPU is visible in WSL
wsl nvidia-smi
```

### Step 2: Clone & configure
```powershell
git clone <repo-url> speakinsights-v3
cd speakinsights-v3
```

### Step 3: Start Docker with Windows override
```powershell
docker compose -f docker-compose.yml -f docker-compose.windows.yml up -d --build
```

This adds:
- **Ollama** container with GPU passthrough (auto-pulls models on first start)
- **WhisperX** with CUDA acceleration (`float16`, faster inference)

### Step 4: Wait for model downloads
```powershell
# Watch Ollama pulling models (first run takes 5-10 min)
docker logs -f speakinsights-ollama-init

# Verify models are ready
docker exec speakinsights-ollama ollama list
```

### Step 5: Verify
```powershell
curl http://localhost:8000/api/health
start http://localhost:3000
```

---

## C. Hetzner VPS (Production)

### Prerequisites
- Hetzner Cloud server: **CPX31** (4 vCPU, 8 GB RAM) or larger
- Ubuntu 22.04 LTS
- Domain name (optional, for HTTPS)

### Step 1: Server setup
```bash
# SSH into your server
ssh root@<server-ip>

# Update & install Docker
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y

# Create deploy user
adduser speakinsights
usermod -aG docker speakinsights
su - speakinsights
```

### Step 2: Deploy
```bash
git clone <repo-url> speakinsights-v3
cd speakinsights-v3

# Install Ollama natively for best performance
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.2:3b
ollama pull nomic-embed-text

# Start services
docker compose up -d --build
```

### Step 3: Configure firewall
```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Frontend
ufw allow 7880/tcp  # LiveKit signaling
ufw allow 7881/tcp  # LiveKit RTC (TCP)
ufw allow 7882/udp  # LiveKit RTC (UDP)
ufw enable
```

### Step 4: Set up reverse proxy (optional, for HTTPS)
```bash
apt install nginx certbot python3-certbot-nginx -y

# Configure nginx as reverse proxy
cat > /etc/nginx/sites-available/speakinsights << 'EOF'
server {
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
    }
    
    location /ws/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

ln -s /etc/nginx/sites-available/speakinsights /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Get SSL certificate
certbot --nginx -d your-domain.com
```

### Step 5: Production environment variables
Create `.env` in the project root:
```env
# Production overrides
CORS_ORIGINS=https://your-domain.com
LIVEKIT_API_KEY=<generate-secure-key>
LIVEKIT_API_SECRET=<generate-secure-secret>
POSTGRES_PASSWORD=<strong-password>
```

---

## D. Exposing via Cloudflare Tunnel

The quickest way to share your local instance with anyone on the internet
(e.g., your professor for a demo).

```bash
# Make the script executable
chmod +x scripts/cloudflare-tunnel.sh

# Run the tunnel
./scripts/cloudflare-tunnel.sh
```

The script will:
1. Install `cloudflared` if not present (via Homebrew on Mac)
2. Check that SpeakInsights is running on port 3000
3. Start a free quick tunnel (no Cloudflare account needed)
4. Print a public URL like `https://random-name.trycloudflare.com`

Share that URL — anyone can access your full SpeakInsights instance through it.

> **Note:** WebSocket connections (live captions, lobby, meeting events)
> work through Cloudflare Tunnel automatically.

> **Tip:** For a stable URL, create a free Cloudflare account and use
> `cloudflared tunnel create speakinsights` for a persistent tunnel.

---

## Troubleshooting

### Docker memory issues
```
Error: Container killed (OOM) / exited with code 137
```
**Fix:** Increase Docker Desktop memory allocation:
- Mac: Docker Desktop → Settings → Resources → Memory → **8 GB+**
- Windows: WSL 2 global config:
  ```
  # ~/.wslconfig
  [wsl2]
  memory=8GB
  ```

### LiveKit connection problems
```
Error: WebRTC connection failed / ICE connection timeout
```
**Possible causes:**
1. **Firewall:** Ensure ports 7880 (TCP), 7881 (TCP), 7882 (UDP) are open
2. **Docker networking:** LiveKit needs `network_mode: host` or proper port mapping
3. **Browser:** Chrome/Edge recommended; Safari has WebRTC quirks
4. **Fix for local dev:** Open `chrome://flags` → disable "Block insecure private network requests"

### WhisperX model download issues
```
Error: Model download failed / connection timeout
```
**Fix:**
```bash
# Check WhisperX container logs
docker logs speakinsights-whisperx

# The model downloads on first request (~1 GB for "small")
# If it fails, restart the container:
docker compose restart whisperx

# Or pre-download manually:
docker exec speakinsights-whisperx python -c "import whisperx; whisperx.load_model('small', 'cpu')"
```

### Ollama connection refused
```
Error: Cannot connect to Ollama / connection refused at localhost:11434
```
**Fix (Mac):**
```bash
# Ensure Ollama is running
ollama serve  # or check menu bar icon

# Test connectivity
curl http://localhost:11434/api/tags

# Verify Docker can reach host
docker exec speakinsights-backend curl http://host.docker.internal:11434/api/tags
```

**Fix (Windows Docker):**
```bash
# Ollama runs inside Docker — check container
docker logs speakinsights-ollama

# Wait for model pull to complete
docker logs speakinsights-ollama-init
```

### CORS errors
```
Error: Access-Control-Allow-Origin header missing
```
**Fix:** Update `CORS_ORIGINS` in `backend/app/config.py` or `.env`:
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://your-domain.com
```
Then restart: `docker compose restart backend`

### WebSocket connection failures
```
Error: WebSocket connection to ws://localhost:8000/ws/... failed
```
**Possible causes:**
1. **Wrong URL:** Ensure frontend connects to `ws://` (dev) or `wss://` (production)
2. **Nginx:** Proxy must forward `Upgrade` and `Connection` headers (see nginx config above)
3. **CORS:** WebSocket initial handshake is an HTTP request — CORS must allow the origin
4. **Fix:** Check browser DevTools → Network → WS tab for detailed error

### Port conflicts
```
Error: Bind for 0.0.0.0:3000 failed: port is already allocated
```
**Fix:**
```bash
# Find what's using the port
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process or change the port in docker-compose.yml:
# ports:
#   - "3001:80"  # changed from 3000
```

### Database connection errors
```
Error: PostgreSQL connection refused / could not connect to server
```
**Fix:**
```bash
# Check PostgreSQL container
docker compose ps postgres
docker logs speakinsights-postgres

# Reset database (WARNING: destroys data)
docker compose down -v  # removes volumes
docker compose up -d    # fresh start with init-db.sql
```

### Recording / Egress issues
```
Error: Egress service not available / recording failed
```
**Fix:**
```bash
# Check egress container
docker logs speakinsights-egress

# Ensure storage directory is writable
docker exec speakinsights-backend ls -la /app/storage/recordings/

# Egress needs LiveKit to be healthy
docker logs speakinsights-livekit
```

---

## Useful Commands

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend

# Restart a single service
docker compose restart backend

# Rebuild and restart
docker compose up -d --build backend

# Full reset (destroys all data)
docker compose down -v && docker compose up -d --build

# Check resource usage
docker stats --no-stream

# Access PostgreSQL directly
docker exec -it speakinsights-postgres psql -U postgres -d speakinsights

# Run demo data script
python scripts/demo-data.py

# Backend API docs
open http://localhost:8000/docs
```
