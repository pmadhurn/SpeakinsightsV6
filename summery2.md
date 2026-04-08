# SpeakInsights: Comprehensive Project Summary

## 1. Project Overview

*   **Project Title:** SpeakInsights
*   **Objective:** To architect and deploy a privacy-first, multi-person meeting intelligence platform that provides real-time video conferencing, automated transcription, and post-meeting Large Language Model (LLM) analysis while strictly maintaining data sovereignty within the deployment boundary.
*   **Problem Statement:** Modern organizations heavily rely on video conferencing and AI meeting assistants. However, integrating multiple fragmented SaaS solutions (e.g., Zoom for video, Otter.ai for transcription, ChatGPT for intelligence) results in escalating subscription costs, disparate workflows, and severe security risks due to proprietary data continuously leaving the corporate network.
*   **Motivation behind the project:** To consolidate a WebRTC-based Selective Forwarding Unit (SFU) with local Automatic Speech Recognition (ASR) and open-weights Large Language Models into a single, cohesive, dockerized platform. This ensures that sensitive audio, video, and textual data are processed and retained securely on-premises.
*   **Real-world relevance:** SpeakInsights directly addresses the stringent compliance needs of privacy-conscious enterprises (healthcare, legal, finance sectors), development teams requiring automated sprint meeting extraction, and educational institutions needing robust, license-free meeting capabilities with integrated accessibility features.

## 2. System Description

*   **High-level explanation of how the system works:** The system operates as a self-hosted, containerized cluster. Users interact via a React-based frontend served by Nginx. The frontend communicates with a FastAPI orchestration backend for signaling and metadata, while routing real-time media securely through the LiveKit SFU. Post-meeting, asynchronous workers process recorded audio utilizing WhisperX for transcription and a configurable LLM provider (Ollama or OpenRouter) for summarization and feature extraction.
*   **Key features and functionalities:**
    *   Secure lobbied video conferencing via cryptographic join codes (6-character alphanumeric).
    *   Real-time in-browser closed captions alongside high-fidelity post-meeting transcription.
    *   Granular post-meeting intelligence (executive summaries, key decisions, prioritized action items).
    *   Utterance-level sentiment analysis visualized via a chronologically synced Mood Timeline.
    *   Privacy-preserving, Retrieval-Augmented Generation (RAG)-powered chat for contextual querying of past meetings.
    *   Interoperable export of action items as `.ics` calendar files.
*   **End-to-end workflow:** 
    1. A host generates a meeting and distributes the cryptographic join code.
    2. Participants join the waiting room; the host approves them via real-time WebSocket signaling.
    3. During the meeting, individual audio/video tracks are routed and recorded by LiveKit Egress.
    4. Upon conclusion, an 11-step automated post-processing pipeline initiates: downloading recordings, isolating tracks for explicit speaker diarization, performing WhisperX transcription with VADER sentiment scoring, chunking transcripts, generating pgvector embeddings via Ollama, and synthesizing final intelligence metrics (summaries, tasks).

## 3. System Architecture & Design

*   **Architecture type:** Containerized microservices architecture coordinated via Docker Compose.
*   **Component-level breakdown:**
    *   **Presentation Layer:** React 18 frontend with Vite and TailwindCSS.
    *   **Application Logic Layer:** Asynchronous FastAPI backend server.
    *   **Media Transport Layer:** LiveKit WebRTC SFU and Egress recording service.
    *   **AI & Analytics Workers:** Dedicated API for WhisperX transcription and an abstracted LLM Provider layer (Ollama/OpenRouter).
    *   **Persistence Layer:** PostgreSQL 16 (equipped with the `pgvector` extension) and Redis 7.
*   **Data flow explanation:**
    *   **Client ↔ Backend:** Real-time application state logic (e.g., lobby approvals) operates over WebSockets; standard CRUD and AI queries utilize RESTful HTTP/JSON.
    *   **Client ↔ LiveKit:** WebRTC protocols handle peer-to-peer video/audio streams securely (UDP or WSS/TCP fallback).
    *   **Backend ↔ AI Services:** The FastAPI application offloads heavy computation by transferring audio arrays to the WhisperX HTTP service and prompting the active LLM provider asynchronously, avoiding event-loop bottlenecks.
*   **Design decisions and reasoning:**
    *   **Track Isolation over Diarization:** Leveraging LiveKit’s capability to egress individual participant tracks eliminates the computational overhead and inaccuracy of AI-based speaker diarization.
    *   **Dual-Path Transcription:** Utilizing the immediate Window Speech API for real-time captions guarantees zero-latency accessibility, while the heavy WhisperX pipeline guarantees high-fidelity, aligned transcripts post-meeting.

## 4. Module-wise Detailed Explanation

### Presentation Layer (Frontend)
*   **Module name:** Frontend User Interface
*   **Purpose:** To provide a highly responsive, glassmorphic ("Frosted Aurora" aesthetic) interface for meeting participation and post-meeting analysis.
*   **Internal working:** Manages complex real-time meeting states globally using Zustand. Utilizes standard React functional components enriched with `framer-motion` for fluid transitions and `recharts` for sentiment visualization. Uses the LiveKit React SDK to manage WebRTC track subscriptions locally.
*   **Technologies used:** React 18.3, TypeScript, Vite, TailwindCSS 3.4.4, Zustand, Framer Motion, Recharts.
*   **Inputs & outputs:** Inputs include user media hardware streams (camera/mic) and interaction events. Outputs include DOM rendering, WebSocket signaling payloads, and WebRTC streaming packets.
*   **Interactions with other modules:** Forms the sole client application interacting directly with the LiveKit SFU components and the FastAPI routing endpoints.

### Application Logic Layer (Backend Core)
*   **Module name:** FastAPI Orchestrator
*   **Purpose:** Serves as the central nerve center handling routing, lobby security, database migrations, and pipeline orchestration.
*   **Internal working:** Implemented completely asynchronously to maximize I/O concurrency. Validates inbound data via Pydantic models. Manages three distinct WebSocket channels (`/ws/lobby`, `/ws/transcript`, `/ws/meeting`) for granular real-time event distribution.
*   **Technologies used:** FastAPI 0.115.0, Python 3.11+, Uvicorn 0.30.0, SQLAlchemy 2.0 (async), Alembic, Pydantic 2.9.0.
*   **Inputs & outputs:** Processes HTTP JSON payloads and WebSocket frames; yields structured JSON API responses and SQL transactions.
*   **Interactions with other modules:** The central proxy accessing PostgreSQL for persistence, Redis for caching/pub-sub, and delegating inference to AI microservices.

### Media Transport Layer
*   **Module name:** LiveKit Server & Egress
*   **Purpose:** To manage low-latency routing of multi-party audio/video streams and to write precise recordings of the session to disk.
*   **Internal working:** Distributes mesh network traffic efficiently as a Selective Forwarding Unit. The Egress service captures raw media from the room and writes composite `.mp4` and individual participant `.ogg` tracks locally to the `/storage` volumes.
*   **Technologies used:** LiveKit API 1.1.0 server architecture (Go-based SFU).
*   **Inputs & outputs:** Ingests raw WebRTC tracks; outputs distributed tracks to subscribed peers and localized media files to disk.
*   **Interactions with other modules:** Authenticates users via cryptographic JWT tokens issued by the FastAPI backend; triggers backend webhooks upon recording completion.

### AI & Analytics Layer
*   **Module name:** WhisperX Service & Generic LLM Layer
*   **Purpose:** To extract textual data from raw audio and compute semantic intelligence (summaries, tasks, embeddings).
*   **Internal working:** WhisperX executes Voice Activity Detection (VAD) and forced alignment to generate extremely precise timestamped text. The LLM abstraction layer directs prompts to either a local Ollama instance (e.g., Llama 3.2) or the cloud OpenRouter API (e.g., MiniMax, GPT-4o) depending on user configuration. Document chunking and `nomic-embed-text` embeddings are always handled locally for stable RAG vector geometry.
*   **Technologies used:** WhisperX, Ollama Engine, OpenRouter API Client, VADER Sentiment 3.3.2.
*   **Inputs & outputs:** Audio `.ogg` binaries and system prompts matrix -> timestamped transcripts, numerical sentiment scores, JSON-structured tasks, and 768-dimensional vector arrays.
*   **Interactions with other modules:** Polled primarily by the FastAPI orchestrator during the post-meeting background data pipeline.

### Persistence Layer
*   **Module name:** Database & Cache
*   **Purpose:** To guarantee ACID-compliant long-term storage of platform data and facilitate rapid state management.
*   **Internal working:** Maintains relational schemas utilizing asynchronous database drivers (`asyncpg`). Extends traditional DB capabilities via the `pgvector` extension to store and perform K-Nearest Neighbor (KNN) semantic searches across transcript chunks. Redis manages WebSocket connection pooling and acts as a fast-access cache tier.
*   **Technologies used:** PostgreSQL 16, pgvector 0.3.0, Redis 5.0.0.
*   **Inputs & outputs:** SQL statements and vector distances; Returns row entities and boolean/status flags.
*   **Interactions with other modules:** Exclusively accessed programmatically by the FastAPI ORM layer.

## 5. Technology Stack

*   **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Zustand. (Justification: Provides an optimized, type-safe development environment with boilerplate-free state management tailored for highly dynamic collaborative UIs).
*   **Backend:** FastAPI, Python, SQLAlchemy, Uvicorn. (Justification: FastAPI’s native asynchronous framework ensures high throughput utilizing Python, which is strictly requisite for interfacing with advanced AI mathematical libraries).
*   **Database:** PostgreSQL with `pgvector`, Redis. (Justification: Unifying relational data and vector embeddings within Postgres reduces architectural complexity and infrastructure overhead compared to deploying a separate vector database like Pinecone).
*   **APIs & WebRTC:** LiveKit API, OpenRouter API. (Justification: LiveKit is chosen over WebRTC primitive APIs for its robust SFU mesh management, built-in Egress recording, and out-of-the-box React hooks).
*   **Tools and Frameworks:** Docker, Docker Compose, Alembic, iCalendar. (Justification: Docker guarantees absolute parity across MacOS and Windows environments, solving the "it works on my machine" paradigm when resolving complex CUDA/Metal GPU bindings).

## 6. Requirements

### Functional Requirements
*   Generate unique 6-character alphanumeric cryptographic codes per meeting session.
*   Enforce a host-approval lobby phase prior to participant media ingestion.
*   Render real-time visual grids of active participants utilizing WebRTC UDP channels.
*   Generate live, on-device closed captions during the session.
*   Process raw audio offline to generate timestamped, speaker-attributed transcripts.
*   Automatically extract structured Action Items (Task, Assignee, Priority, Due Date).
*   Provide contextual Retrieval-Augmented Generation (RAG) chat interfaces to query historical transcripts.
*   Export detected tasks as standard `.ics` formatted calendar files.

### Non-Functional Requirements
*   **Performance:** The system must prevent locking the main Python event loop; all heavy AI tasks must execute as background jobs or decoupled processes.
*   **Scalability:** The architecture must be inherently horizontally scalable, storing volatile state in Redis to permit API node replication.
*   **Security:** Cryptographic JWT exchange for media tokens; all default analytics and transcriptions must execute locally (Ollama) to prevent data leakage.
*   **Reliability:** In the event of an AI worker failure (e.g., WhisperX Out of Memory), the WebRTC meeting cluster must continue to operate flawlessly.
*   **Usability:** Adhere to a "Frosted Aurora" design system, providing a clean, distraction-free environment with accessible color contrast and intuitive spatial navigation.

## 7. Deployment Details

*   **Deployment architecture:** Containerized, single-node Docker setup orchestrated via `docker-compose.yml`, architected to instantly translate to multi-node Kubernetes clusters.
*   **Hosting environment:** Local environments (Apple Silicon via native execution, Windows via WSL2 + NVIDIA Container Toolkit) or generic Cloud-hosted Virtual Machines with Docker support.
*   **CI/CD:** The monolithic repository structure supports standard GitHub Actions pipelines triggering automated Docker build verifications prior to registry push.
*   **Steps to deploy the system:**
    1. Clone the repository and navigate to `speakinsights-v3`.
    2. Duplicate `.env.example` to `.env` and assign LiveKit cryptographic secrets (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`).
    3. Execute deployment script: `docker-compose up -d --build` (utilize `docker-compose -f docker-compose.windows.yml up -d` for Windows environments to map CUDA paths).
*   **Environment configuration:** Variables dictate application behavior securely via a central `.env` file containing database URLs, API keys, CORS origins, and default LLM bindings.

## 8. System Design Details

*   **Database Schema (Core Entities):**
    *   `Meeting`: Hub for all data (id, title, status, timestamps). 1:N relations with lower entities.
    *   `Participant`: Stores identity and lobby state. N:1 with `Meeting`.
    *   `TranscriptionSegment`: Granular transcript chunks (speaker_name, text, start_time, sentiment_score).
    *   `Summary` & `Task`: Extracted intelligence data schemas stored as JSONB structured payloads.
    *   `TranscriptEmbedding`: Stores `chunk_text` alongside a 768-dimensional `embedding` vector via `pgvector`.
*   **API Structure:**
    *   RESTly segregated under distinct routers: `/api/meetings/` (CRUD & join logic), `/api/transcriptions/` (retrieval & search), `/api/summaries/` (AI generation triggers), `/api/chat/` (RAG chat endpoints), and `/api/calendar/` (ICS provisioning).
    *   Real-time event channels localized to `/ws/lobby/{meeting_id}` (admission control), `/ws/transcript/{meeting_id}` (live captions), and `/ws/meeting/{meeting_id}` (lifecycle events).
*   **UI/UX Design Principles:** Employs specialized viewports. The `MeetingRoom.tsx` maximizes spatial utility for video tiles, while the post-meeting `MeetingReview.tsx` shifts focus to analytical presentation utilizing responsive grids, highlighted transcription tracking, and a dynamic color-coded Mood Timeline correlating sentiment to timeline timestamps.

## 9. Limitations

*   **Current system limitations:** The exhaustive 11-step post-processing AI pipeline is currently executed within FastAPI background tasks. Under heavy concurrent load across dozens of simultaneous meetings, this may constrain the primary API node computing resources.
*   **Technical constraints:** Local Large Language Models and WhisperX inference models consume vast amounts of VRAM. Operating the system smoothly strictly localized requires hardware with independent GPU acceleration or robust unified memory structures (e.g., Apple M-Series chips).
*   **Known issues:** Corporate firewall proxys (e.g., strict Cloudflare topologies) often aggressively drop WebRTC UDP packets, mandating the use of slower TCP/WSS LiveKit fallback tunnels which may marginally introduce audio latency.

## 10. Future Enhancements

*   **Features to be added:** Migration from link-based sharing to strict institutional Auth integration via JWT-based single sign-on (SAML/OAuth2) enabling formal Role-Based Access Control (RBAC).
*   **Scalability improvements:** Offloading background inference jobs from the FastAPI event loop into highly distributed task queues facilitated by Celery or BullMQ workers, permitting independent auto-scaling of AI compute nodes.
*   **Performance upgrades:** Establishing continuous bidirectional WebSocket data streaming directly to an optimized LLM to instantiate "Live AI Intervention"—providing participants real-time contextual hints or fact-checking during the meeting phase itself.
*   **Possible integrations:** Expanding the `LLMProvider` facade pattern to natively interface with secure enterprise deployments of AWS Bedrock, Anthropic Claude, and direct OpenAI architectures for users who lack local GPU resources but maintain vetted B2B cloud privacy agreements.

## 11. Conclusion

*   **Summary of achievements:** The SpeakInsights platform successfully orchestrates cutting-edge real-time WebRTC media protocols alongside state-of-the-art Generative AI frameworks into an uncompromisingly secure, full-stack application. It demonstrates comprehensive mastery of asynchronous backend logic, modern React state architecture, vector database implementation, and containerized deployment strategies.
*   **Final impact of the project:** By resolving the dichotomy between deep institutional intelligence and non-negotiable data sovereignty, SpeakInsights presents a robust blueprint for the future of enterprise communication technology, empowering teams to leverage automated meeting analysis without sacrificing proprietary security.