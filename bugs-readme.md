To run **SpeakInsights v3** without Docker, you will need to manually set up and run each of its components. This project is a multi-service application, so it requires several background services.

### 1. Identified Bugs & Fixes
Based on the logs and source code, here are the bugs I found and how to fix them:

*   **Redis Health Check Bug**: In [backend/app/main.py](cci:7://file:///d:/project%20java/SpeakinsightsV6/speakinsights-v3/backend/app/main.py:0:0-0:0), the health check for Redis might fail with `AttributeError: 'Redis' object has no attribute 'aclose'`. This happens because of a version mismatch or incorrect method call in the `redis-py` library.
    *   **Fix**: Update `await r.close()` to `await r.aclose()` if using Redis 5.0+, or better yet, use an `async with` block.
*   **LiveKit Egress Error**: The recording service fails with `request has missing or invalid field: output`. 
    *   **Fix**: In [backend/app/core/livekit_service.py](cci:7://file:///d:/project%20java/SpeakinsightsV6/speakinsights-v3/backend/app/core/livekit_service.py:0:0-0:0), the `RoomCompositeEgressRequest` might need to be updated to use `file_outputs=[output]` instead of `file=output`, depending on your LiveKit server version.
*   **WhisperX Timeouts**: The backend occasionally reports `httpx.ReadTimeout` when talking to the transcription service.
    *   **Fix**: Increase the `timeout` in `backend/app/core/whisperx_client.py` from the default to `60.0` or higher, as transcription is a heavy task.

---

### 2. How to Run Without Docker (Windows Guide)

You will need to open multiple Terminal/PowerShell windows to keep all services running.

#### **Step A: Prerequisite Services**
1.  **PostgreSQL 16**:
    *   Download and install [PostgreSQL for Windows](https://www.postgresql.org/download/windows/).
    *   Install the **pgvector** extension (you can follow the [pgvector installation guide](https://github.com/pgvector/pgvector#windows)).
    *   Create a database named `speakinsights`.
2.  **Redis**:
    *   Install Redis on Windows via [WSL2](https://learn.microsoft.com/en-us/windows/wsl/tutorials/wsl-redis) or use [Memurai](https://www.memurai.com/) (a Windows-native Redis port).
3.  **Ollama**:
    *   Install [Ollama for Windows](https://ollama.com/download/windows).
    *   Run these commands in PowerShell to get the models:
        ```powershell
        ollama pull llama3.2:3b
        ollama pull nomic-embed-text
        ```
4.  **LiveKit Server**:
    *   Download the [LiveKit Release](https://github.com/livekit/livekit/releases) for Windows.
    *   Run it using the provided config:
        ```powershell
        .\livekit-server.exe --config .\livekit.yaml
        ```

#### **Step B: Running the Python Services**

**1. WhisperX Service (Transcription)**
*   Open a new terminal in `speakinsights-v3\whisperx-service`.
*   Create a virtual environment: `python -m venv venv`
*   Activate it: `.\venv\Scripts\activate`
*   Install dependencies: `pip install -r requirements.txt`
*   Run the service: `python -m app.main` (runs on port 9000).

**2. Backend API (FastAPI)**
*   Open a new terminal in `speakinsights-v3\backend`.
*   Create a virtual environment: `python -m venv venv`
*   Activate it: `.\venv\Scripts\activate`
*   Install dependencies: `pip install -r requirements.txt`
*   **Configure Environment**: Copy `.env.example` to `.env` and update the database URLs to point to your local PostgreSQL/Redis.
*   Run migrations: `alembic upgrade head`
*   Run the API:
    ```powershell
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ```

#### **Step C: Running the Frontend**
*   Open a new terminal in `speakinsights-v3\frontend`.
*   Install Node dependencies: `npm install`
*   Run the dev server: `npm run dev`
*   Access the app at `http://localhost:3000`.

### Summary of URLs for Manual Setup:
*   **Frontend**: `http://localhost:3000`
*   **Backend API**: `http://localhost:8000`
*   **API Docs**: `http://localhost:8000/docs`
*   **WhisperX**: `http://localhost:9000`
*   **LiveKit**: `host: 127.0.0.1, port: 7880`

> [!TIP]
> Since you are on Windows, ensure your Firewall allows the ports (8000, 3000, 7880, 9000). If you have an NVIDIA GPU, make sure you have the CUDA toolkit installed so WhisperX and Ollama run much faster!