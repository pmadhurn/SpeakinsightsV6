# SpeakInsights: Comprehensive Project Summary and Technical Architecture

## 1. Project Overview

### Purpose of the Project
SpeakInsights is a cutting-edge, privacy-first, multi-person meeting intelligence platform. It provides a complete, self-hosted, end-to-end solution for video conferencing, real-time transcription, and post-meeting AI analysis. The project is designed to deliver a modern, premium user experience—featuring a "Frosted Aurora" glassmorphism aesthetic—while keeping all sensitive data (audio, video, transcripts) entirely within the deployment environment.

### Core Problem It Solves
Modern organizations rely heavily on video conferencing and AI meeting assistants, but this reliance often compromises data sovereignty. Integrating multiple SaaS solutions (e.g., Zoom for video, Otter.ai for transcription, ChatGPT for summaries) results in fragmented workflows, escalating subscription costs, and significant security risks due to data leaving the corporate network. SpeakInsights solves this by unifying a WebRTC Selective Forwarding Unit (SFU) with local, open-weights Large Language Models (LLMs) and local Automatic Speech Recognition (ASR) into a single, cohesive, dockerized platform.

### Target Users and Use Cases
- **Privacy-Conscious Enterprises:** Organizations handling proprietary, classified, or sensitive information (e.g., healthcare, legal, finance) where uploading transcripts to third-party cloud AI vendors is legally prohibitive.
- **Development & Agile Teams:** Teams conducting sprint planning, daily stand-ups, or retrospectives who need automated, rigorous extraction of action items and decisions without administrative overhead.
- **Educational Institutions:** Deployments requiring robust meeting capabilities and accessibility features (live captions, multi-language support) without per-user licensing fees.

---

## 2. System Architecture

### High-Level Architecture
The system is built on a containerized microservices architecture coordinated via Docker Compose. It separates the application into distinct, highly specialized layers:
- **Presentation Layer:** A React UI served via an Nginx reverse proxy.
- **Application Logic Layer:** An asynchronous FastAPI backend acting as the orchestrator for REST endpoints and WebSocket signaling.
- **Media Transport Layer:** A dual-compatible WebRTC SFU layer supporting both self-hosted LiveKit and **LiveKit Cloud**. It manages low-latency video rendering and handles egress recordings (including polling and HTTP downloading of externally-stored Cloud recordings back to local storage).
- **AI & Analytics Layer:** Dedicated services for speech-to-text (WhisperX) and language modeling (Ollama).
- **Persistence Layer:** PostgreSQL with the `pgvector` extension for relational data and embeddings, supplemented by Redis for caching and message brokering.

### Design Patterns and Architectural Decisions
- **Dual-Path Transcription Strategy:** To balance latency and fidelity, the frontend leverages the browser's Web Speech API for immediate, zero-latency live captions. Simultaneously, an asynchronous "accurate path" chunks the recorded audio and passes it to WhisperX to generate highly accurate, long-form transcripts with word-level timestamps and speaker attribution.
- **Event-Driven Post-Processing:** When a meeting concludes, the system triggers a 7-step automated processing pipeline (transcription → alignment → embedding generation → AI summary → action item extraction → sentiment analysis → `.ics` calendar generation) decoupled from the end-user request thread.
- **Retrieval-Augmented Generation (RAG):** The system implements a local RAG architecture. Meeting transcripts are chunked, embedded using `nomic-embed-text`, and stored in `pgvector`. User queries trigger a semantic search, surfacing relevant chunks that are injected into the prompt for the Llama model, ensuring grounded, hallucination-free AI responses.

### Data Flow and Communication
- **Client ↔ Backend:** Real-time state updates (like lobby approvals) utilize WebSockets. Standard CRUD operations and AI queries use RESTful HTTP calls.
- **Client ↔ LiveKit:** WebRTC handles video/audio streams via UDP (fallback to TCP), bypassing the core API for minimal latency.
- **Backend ↔ AI Services:** Background tasks communicate with WhisperX via HTTP REST and Ollama via HTTP to submit audio batches and extraction prompts.

---

## 3. Component-Level Breakdown

### Frontend (`/frontend`)
- **React 18 & Vite:** Provides a blistering fast development server and optimized production build.
- **Modular Architecture:** Refactored from a monolithic codebase into a highly structured system comprising dedicated directories for `components`, `hooks`, `pages`, `services`, and `stores`—guaranteeing long-term maintainability.
- **Zustand:** Manages complex real-time application state without the boilerplate of Redux.
- **TailwindCSS v4:** Enables the custom "Frosted Aurora" UI through utility-first styling, providing the necessary glassmorphism effects and dynamic background animations.
- **Responsibilities:** Interface rendering, LiveKit client integration for dynamic video grids, Web Speech API integration for live captions, and seamless WebSocket coordination.

### Backend (`/backend`)
- **FastAPI:** The core API server, executing on Python 3.11+. It manages routing (`/api`), configuration (`/core`), and WebSocket connections (`/websockets`).
- **SQLAlchemy (Async):** Interfaces with PostgreSQL utilizing asynchronous drivers (`asyncpg`) to maximize I/O concurrency.
- **Alembic:** Handles database migrations (`/db`).
- **Responsibilities:** Orchestrating the post-meeting intelligence pipeline, managing the lobby security system, handling REST logic, coordinating embeddings, and serving as the proxy between the React frontend and local AI instances.

### AI Engine & Workers
- **WhisperX Service (`/whisperx-service`):** A customized Python wrapper around the WhisperX model, deployed independently to isolate heavy GPU/CPU compute from the core API. Responsibilities include transcription, text alignment, and sentiment scoring per utterance.
- **Ollama Engine:** Runs locally (or within Docker with NVIDIA toolkit bindings) to handle LLM inferences. Responsibilities include executing detailed prompts for summarization and feature extraction.

### Storage & Media Server
- **LiveKit Server & Egress:** Facilitates room creation, peer-to-peer routing, and streams output directly to standard media files (MP4, individual audio tracks) located in the mounted `/storage` volume.
- **PostgreSQL 16 & Redis 7:** PostgreSQL ensures ACID compliance for user/meeting metadata, while Redis facilitates rapid state retrievals and future-proofs the system for message-queue implementations (like Celery).

---

## 4. Technologies & Stack

### Frontend
- **React 18 + TypeScript + Vite:** Chosen for rendering speed, type safety, and fast build times.
- **TailwindCSS 4:** Chosen for rapid, design-system-driven aesthetic implementations.

### Backend
- **FastAPI (Python 3.11+):** Selected for its native asynchronous capabilities, automatic OpenAPI (Swagger) documentation generation, and exceptional throughput.
- **SQLAlchemy + asyncpg + Alembic:** Provides a robust, full-featured ORM while preventing blocking operations on the primary event loop.

### Real-Time & Audio/Video
- **LiveKit:** An open-source alternative to the Zoom SDK. The architecture supports both local self-hosted containers and **LiveKit Cloud** deployments—enabling flexible scaling. By using LiveKit Egress to record individual participant tracks, SpeakInsights completely bypasses the need for error-prone AI speaker diarization.

### AI & Machine Learning
- **Ollama (llama3.2:3b / llama3.1:8b / nomic-embed-text):** Selected for its seamless local deployment, completely eliminating API costs and ensuring 100% data privacy.
- **WhisperX:** Selected over standard Whisper. WhisperX implements Voice Activity Detection (VAD) and forced alignment, producing precise timestamping essential for syncing transcripts to recorded playback.

### Data & Infrastructure
- **PostgreSQL 16 w/ pgvector:** Picked for its ability to unified relational data storage and vector embeddings in a single technology stack, reducing architectural complexity.
- **Redis 7:** Currently caching and signaling state; positioned to support scalable task queues.
- **Docker & Docker Compose:** Guarantees environment consistency across MacOS (Apple Silicon) and Windows (WSL2 + NVIDIA Toolkit).

---

## 5. Key Features & Functionality

### Secure Lobbied Conferencing
Meetings generate unique cryptographic join codes. Participants undergo a lobby phase where the host receives live WebSocket notifications and selectively grants entry. This mitigates unauthorized access and "Zoombombing."

### Granular Post-Meeting Intelligence
Once a host concludes the session, the backend orchestrator:
1. Distills individual participant audio files via WhisperX.
2. Aggregates and interleaves the responses to recreate the temporal flow of the conversation.
3. Injects the transcript into an Ollama instance to synthesize an Executive Summary, Key Decisions, and specific Action Items with assigned owners and severities.

### Sentiment Analysis & Mood Timeline
Utterances are scored algorithmically (via VADER and LLM validation). The frontend maps these scores into a color-coded "Mood Timeline" synced to the meeting video playback, allowing reviewers to rapidly jump to moments of high friction or enthusiasm.

### Privacy-Preserving RAG Chat
Users can interact with a ChatGPT-like interface localized entirely to the context of their past meetings. By searching nearest-neighbor embeddings in `pgvector`, the AI engine can answer specific queries ("What did Alice say about the budget?") directly supported by meeting citations.

### Interoperable Export (ICS)
The engine formats generated action items with target dates into standard `.ics` payloads, empowering users to immediately integrate the resultant intelligence into Outlook, Google Calendar, or Apple Calendar.

---

## 6. Code Design & Practices

### Software Engineering Principles
- **Separation of Concerns & Modularity:** The code isolates infrastructure (Docker), UI logic (React), external integrations (WhisperX, Ollama), and domain logic (FastAPI core features).
- **Asynchrony First:** Every I/O bound path—spanning from PostgreSQL transactions to LLM API invocation—utilizes asynchronous await syntax, ensuring the main application threads are never blocked.
- **SOLID & DRY Design:** Core logic like API key validation, meeting existence checks, and error responses are abstracted into dependency-injected utilities (FastAPI `Depends`) and reusable React Hooks.

### Fault Tolerance & Graceful Degradation
The architecture explicitly addresses the inherent unreliability of heavy ML inference:
- If Ollama or WhisperX crashes or responds slowly, the core LiveKit meeting continues flawlessly. Core WebRTC traffic is independent of the REST API.
- If WhisperX is unavailable, the fallback browser Web Speech API guarantees text capture.
- Complex processing steps expose asynchronous status markers, allowing the client to poll or receive server-sent events detailing exactly what stage the post-processing pipeline is at, without locking the user interface.

---

## 7. Performance & Optimization

- **Implicit Diarization via Track Isolation:** By leveraging LiveKit’s capability to egress individual audio tracks per user, the application avoids computationally expensive and mathematically complex speaker diarization models, solving attribution with 100% accuracy on the infrastructure level.
- **Metal / GPU Inference Offloading:** The implementation optimally routes Ollama and WhisperX tasks. On macOS, Ollama runs transparently on the host OS to hijack the Apple Silicon native Metal framework; on Windows, Docker leverages the NVIDIA Container Toolkit.
- **Batched Audio Processing:** The internal WhisperX worker utilizes configured tensor batch sizes (e.g., `BATCH_SIZE=8`) and quantized computation (`COMPUTE_TYPE=int8`) to balance exactitude against VRAM consumption.

---

## 8. Scalability & Future Improvements

### Scalability Posture
While currently orchestrated for a cohesive single-node (or local development) Docker deployment, the architecture is primed for horizontal scalability. LiveKit inherently supports distributed clustering using Redis. FastAPI and the frontend can map redundantly behind load balancers.

### Future Enhancements
- **Message Queue Worker Separation:** Rather than executing the 7-step data pipeline in FastAPI background tasks, leveraging Celery or BullMQ paired with Redis will decouple job execution, enabling scalable worker pools dedicated purely to AI tasks.
- **Enterprise Authentication:** Implement JWT-based SSO (SAML/OAuth2) alongside Role-Based Access Control (RBAC) to transition from "link-sharing" to enterprise-grade organizational models.
- **Real-Time AI Intervention:** Stream live audio tracks through WebSocket arrays directly to an online LLM to provide active meeting prompts (e.g., dynamically suggesting questions during an interview).

---

## 9. Conclusion

SpeakInsights v3 represents a sophisticated, expertly engineered synthesis of modern web technologies, real-time communications, and generative AI. It demonstrates an advanced understanding of containerized microservice architectures and tackles profound industry problems regarding data sovereignty and subscription fatigue. 

By strategically weaving an open-source SFU (LiveKit) with localized AI models (WhisperX and Ollama), SpeakInsights not only functions as a polished meeting application but establishes a highly extensible, secure foundation for the future of enterprise communication. Its architectural rigors—including async database drivers, fault-tolerant media layers, and a meticulous RAG-powered analytics pipeline—position it at the highest tier of modern full-stack engineering portoflios.
