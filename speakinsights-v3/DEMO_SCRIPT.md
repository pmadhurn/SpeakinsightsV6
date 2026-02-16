# SpeakInsights v3 — Demo Script

> Presentation guide for a 5-10 minute semester project demo.
> Follow this script step by step for a polished, impressive presentation.

---

## Setup Checklist (Before Demo)

- [ ] Docker Compose running: `docker compose ps` (all 7 services healthy)
- [ ] Ollama running natively: `curl http://localhost:11434/api/tags`
- [ ] Models pulled: `llama3.2:3b` and `nomic-embed-text`
- [ ] Demo data loaded: `python scripts/demo-data.py` (gives pre-built history)
- [ ] Two browser windows/tabs ready (Chrome recommended)
- [ ] Screen resolution presenter-friendly (zoom to 110-125%)
- [ ] Browser bookmarks to key URLs:
  - `http://localhost:3000` (main app)
  - `http://localhost:8000/docs` (API docs, optional)

---

## Demo Flow

### Step 1: Landing Page (30 seconds)

**Navigate to:** `http://localhost:3000`

**Talking points:**
- "This is SpeakInsights — a complete meeting platform built with React, FastAPI, LiveKit, and AI."
- "The design uses a 'Frosted Aurora' glassmorphism theme with animated gradient orbs."
- Point out the glass-effect navbar and the animated background.
- "Users can create meetings or join with a code. No account needed."

---

### Step 2: Create a Meeting (30 seconds)

**Action:** Click "Create Meeting"

**Talking points:**
- Fill in: Title = "Demo Sprint Planning", Description = "Live demo meeting"
- "The host selects a language for WhisperX transcription — it supports auto-detection and 99+ languages."
- Click "Create" → show the generated meeting code and shareable link.
- "This code can be shared with anyone. They join via the lobby system."

---

### Step 3: Join as Participant (30 seconds)

**Action:** Open a second browser tab/window → paste the join link

**Talking points:**
- "In a real scenario, a participant opens this link on their device."
- Enter name: "Alice" → Click "Request to Join"
- "The participant enters a lobby and waits for host approval. This prevents unwanted guests."

---

### Step 4: Approve & Show Video Grid (1 minute)

**Action:** Switch to host tab → approve participant in lobby notification

**Talking points:**
- "The host sees a real-time notification via WebSocket."
- Click "Approve" → participant joins the room.
- "Video conferencing is powered by LiveKit — an open-source, self-hosted WebRTC platform."
- "It handles up to 20 participants with active speaker detection."
- "Recording starts automatically — both composite video and individual audio tracks per participant."
- Show the video grid with camera feeds.

---

### Step 5: Live Captions (1 minute)

**Action:** Speak a few sentences clearly

**Talking points:**
- "Watch the bottom of the screen — live captions appear instantly."
- "These use the browser's built-in Web Speech API — zero latency, client-side only."
- "This is our 'fast path' for immediate feedback."
- "Meanwhile, the audio is also being chunked every 20 seconds and sent to WhisperX."

---

### Step 6: Accurate Transcript Sidebar (30 seconds)

**Action:** Open the transcript sidebar (if not already visible)

**Talking points:**
- "After ~20 seconds, the accurate WhisperX transcript appears here."
- "WhisperX provides word-level timestamps, confidence scores, and sentiment analysis."
- "Each segment shows the speaker name, timestamp, and sentiment indicator."
- "This is the 'accurate path' — about 20 seconds behind, but much higher quality."

---

### Step 7: End the Meeting (30 seconds)

**Action:** Click "End Meeting" as host

**Talking points:**
- "When the host ends the meeting, the status changes to 'processing'."
- "A 7-step post-processing pipeline kicks off automatically."
- Show the processing status stepper (if visible):
  1. Transcribing individual audio tracks
  2. Merging transcript timeline
  3. Generating embeddings (pgvector)
  4. Creating AI summary (Ollama)
  5. Extracting action items
  6. Analyzing sentiment
  7. Generating calendar file

---

### Step 8: Meeting Review Page (1 minute)

**Action:** Navigate to the review page (or use pre-loaded demo data from History)

> **Tip:** If the live meeting hasn't finished processing yet, switch to
> the pre-loaded "Sprint Planning — Week 12" from the History page.

**Navigate to:** `http://localhost:3000/history` → click a completed meeting

**Talking points:**
- "The review page shows the recorded video synced with the full transcript."
- "Click any transcript segment to jump to that moment in the video."
- "Each segment has speaker attribution, timestamp, and sentiment score."
- "The sentiment colors (green/yellow/red) give a visual mood timeline."
- Show the transcript search feature if available.

---

### Step 9: AI Summary & Tasks (1 minute)

**Action:** Scroll to or click the Summary tab

**Talking points:**
- "Ollama generated an executive summary, key points, and decisions."
- "The AI runs locally — no data leaves the machine. Privacy by design."
- Show the executive summary text.
- Switch to the Tasks tab: "Action items are automatically extracted with assignees and priority levels."
- "Tasks can be marked as in-progress, completed, or cancelled."
- Point out assignee names and due dates.

---

### Step 10: Calendar Export (15 seconds)

**Action:** Click "Export .ics" button

**Talking points:**
- "Tasks with due dates can be exported as a .ics calendar file."
- "This works with Google Calendar, Apple Calendar, Outlook — any calendar app."
- Show the downloaded file.

---

### Step 11: AI Chat (RAG) (1 minute)

**Action:** Navigate to `http://localhost:3000/chat`

**Talking points:**
- "This is our RAG-powered AI chat interface."
- Select a model from the dropdown (e.g., llama3.2:3b).
- Toggle RAG mode ON.
- Type: "What were the main action items from the sprint planning meeting?"
- "The system embeds the question, searches pgvector for relevant transcript chunks, and feeds them to Ollama as context."
- "The AI answers based on actual meeting content — not hallucination."
- Show the response with relevant context.

---

### Step 12: Model Manager (30 seconds)

**Action:** Navigate to `http://localhost:3000/models`

**Talking points:**
- "The model manager lets you pull, inspect, and delete Ollama models."
- "You can see model sizes, quantization levels, and parameters."
- "This makes it easy to experiment with different models."
- Show the model list with sizes.

---

## Potential Professor Questions & Answers

### Q: "Why LiveKit instead of a commercial solution like Zoom SDK?"
**A:** "LiveKit is completely open-source and self-hosted. No API keys, no usage limits, no monthly fees. It handles WebRTC signaling, TURN/STUN, SFU routing, and recording out of the box. For a student project, it's the best option because it's free and gives us full control."

### Q: "Why two transcription systems (Speech API + WhisperX)?"
**A:** "The browser Speech API gives instant, zero-latency captions — great for accessibility during the meeting. But it's English-only and less accurate. WhisperX provides research-grade accuracy with word-level timestamps, multi-language support, and speaker alignment. The dual approach gives us both speed and quality."

### Q: "How does the RAG chat work technically?"
**A:** "Transcript segments are split into chunks. Each chunk is embedded using nomic-embed-text (768-dimensional vectors) and stored in PostgreSQL with the pgvector extension. When a user asks a question, we embed the question, run a cosine similarity search to find the top-K relevant chunks, prepend them as context to the Ollama prompt, and generate a grounded answer."

### Q: "Why Ollama instead of OpenAI API?"
**A:** "Three reasons: Privacy — meeting transcripts never leave the local machine. Cost — no API fees, unlimited usage. Independence — works offline, no rate limits, no API key management. On Apple Silicon with Metal, Ollama achieves very fast inference with the 3B parameter model."

### Q: "How does speaker attribution work without AI diarization?"
**A:** "LiveKit's Egress service records individual audio tracks per participant. Each participant's audio is a separate file labeled with their name. When we run WhisperX on each track separately, the speaker is already known — no diarization needed. This is more accurate than AI-based speaker identification."

### Q: "What happens if Ollama/WhisperX is slow or crashes?"
**A:** "The system is designed for graceful degradation. Live captions work purely client-side — no server dependency. The meeting recording continues regardless of transcription status. If Ollama is slow, the post-processing pipeline retries and the review page shows a progress stepper. All critical meeting data (video, raw audio) is preserved for later processing."

### Q: "How scalable is this?"
**A:** "For the semester project scope, it supports 20 concurrent participants per meeting. LiveKit itself can scale to thousands with SFU architecture. The bottleneck is Ollama inference — one meeting at a time for post-processing. In production, you'd add a task queue (Celery/Bull) and multiple GPU workers."

### Q: "What about security?"
**A:** "The lobby approval system prevents unauthorized joining. All data stays on the local network. For production, we'd add JWT authentication, HTTPS via Nginx + Let's Encrypt, and database encryption. The Cloudflare Tunnel provides encrypted transit for demo access."

---

## Recovery Plans

| Problem | Quick Fix |
|---------|-----------|
| Camera/mic not working | Check browser permissions → chrome://settings/content |
| No live captions | Chrome only; check language = English |
| WhisperX segments not appearing | `docker logs speakinsights-whisperx` → may need model download time |
| Meeting stuck in "processing" | `docker logs speakinsights-backend` → restart backend |
| Ollama slow/unresponsive | `ollama list` → check model is loaded; restart Ollama |
| Video not loading in review | Check `/storage` mount in backend; `docker exec speakinsights-backend ls /app/storage/recordings/` |
| **Plan B:** Use pre-loaded demo data | Navigate to `/history` → "Sprint Planning — Week 12" has everything |
