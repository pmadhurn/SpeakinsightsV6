# Chapter 4: System Requirements

## 4.1 Introduction
The system requirements chapter delineates the fundamental prerequisites, constraints, and operational guidelines necessary for the successful development and deployment of SpeakInsights. It serves as a comprehensive blueprint that bridges the gap between the conceptual design and the technical implementation of the platform. This section categorises the core technical demands into functional and non-functional requirements, whilst outlining the bespoke hardware and software architectural needs tailored for efficient, privacy-first AI processing.

## 4.2 User Characteristics
SpeakInsights is meticulously designed for professionals and organisations that prioritise meeting efficiency, robust decision tracking, and absolute data sovereignty. The system primarily caters to two distinct user profiles:

### 4.2.1 Organisational Users (End Users)
*   **Literacy:** Basic computer or smartphone literacy is required to navigate the web-based environment. No specialised technical training is necessary.
*   **Experience:** Users are expected to have a foundational familiarity with standard video conferencing tools (e.g., Zoom, Microsoft Teams) and possess basic meeting notation habits.
*   **Capabilities:** Users must be capable of initiating meetings, managing participant access, enabling live transcriptions, and intuitively querying the RAG-powered (Retrieval-Augmented Generation) chat interface.
*   **Expectations:** The primary expectation is a professional, distraction-free "Frosted Aurora" aesthetic that minimises cognitive load. Furthermore, users demand real-time transcription accuracy and uncompromising data privacy.
*   **Needs:** A critical requirement for automated AI-driven summaries, instant semantic search across historical conversations, and transparent action item tracking to guarantee follow-through after remote collaborations.

### 4.2.2 System Administrators
*   **Technical Literacy:** Moderate to high technical literacy is essential, particularly regarding the deployment and orchestration of Docker container environments.
*   **Responsibilities:** Administrators are tasked with managing on-site or virtual private server deployments, ensuring GPU/CPU optimisations are properly configured for the local AI engines, and maintaining rigorous data security protocols.
*   **Access Requirements:** Administrators necessitate secure, role-based access control (RBAC) to efficiently manage the backend FastAPI microservices, monitor server health, and fine-tune local AI model parameters.

## 4.3 Functional Requirements
Functional requirements define the specific behaviours, core intelligence operations, and data manipulation capabilities that SpeakInsights must explicitly perform to satisfy the project's objectives.

### 4.3.1 User Authentication and Video Conferencing
*   **FR-1.1 Secure Access:** The system shall restrict platform access via robust authentication and authorisation mechanisms, ensuring enterprise-grade identity verification.
*   **FR-1.2 WebRTC Integration:** The platform must support seamless, low-latency real-time video conferencing for up to 20 concurrent participants.
*   **FR-1.3 Session Management:** Host users shall have the ability to record sessions, mute participants, and natively share screens.

### 4.3.2 AI-Powered Transcription and Diarisation
*   **FR-2.1 Speech-to-Text Processing:** The architecture shall continuously capture spoken audio and convert it to text using the OpenAI Whisper model, targeting a transcription accuracy rate of over 95%.
*   **FR-2.2 Speaker Diarisation:** The system will dynamically provide live speaker attribution, distinctly distinguishing between participants in the generated transcript.
*   **FR-2.3 Live Closed Captions:** The platform must present synchronous live captions rendered directly within the browser interface.

### 4.3.3 Intelligent Insight Extraction
*   **FR-3.1 Automated Summarisation:** Following the conclusion of a session, the system shall utilise BART models (or equivalent) to generate instant, concise, and structured meeting summaries.
*   **FR-3.2 Action Item Identification:** The AI engine must automatically parse transcriptions to extract actionable tasks and reliably assign them to the relevant specific participants.
*   **FR-3.3 Sentiment Analysis:** The backend will evaluate participant engagement and emotional tone throughout the meeting using RoBERTa-driven natural language processing capabilities.

### 4.3.4 RAG-Powered Meeting History
*   **FR-4.1 Semantic Querying:** The platform shall integrate a RAG-powered generative AI chat to allow users to interact dynamically and conceptually with their meeting archives.
*   **FR-4.2 Instant Indexing and Search:** The system is required to instantly index transcriptions into a vector database, facilitating semantic searches that return highly relevant conversation segments within seconds.

### 4.3.5 Reporting and Export Procedures
*   **FR-5.1 Documentation Generation:** The application must offer functional capabilities to generate rapid meeting minutes and executive briefing documents autonomously.
*   **FR-5.2 Formats and Integration:** Support out-of-the-box exportation to PDF, DOCX (Word), TXT, and native Google Calendar (`.ics`) formats.

### 4.3.6 Activity and Proposed System Analysis
*   **Current Activity (Manual System):** Traditionally, up to 55% of meeting content is forgotten within one hour of conclusion. Manual note-taking measurably reduces active participant engagement and leads to fragmented decision tracking. Standard cloud-based solutions heavily compromise organisational privacy by transmitting biometric audio data to third-party endpoints.
*   **Proposed System (SpeakInsights):** SpeakInsights offers 100% automated information capture, ensuring an immutable and complete meeting record (comparing favourably against the estimated ~30% effectiveness of manual capture). By employing robust local processing topologies, the software ensures audio and transcription data never leaves the organisation's secured servers—guaranteeing 100% privacy compliance. 

## 4.4 Non-Functional Requirements
Non-functional requirements specify the vital quality attributes, systemic performance standards, and user-experience benchmarks of SpeakInsights.

### 4.4.1 Performance Engineering
*   **Throughput:** The FastAPI-driven backend architecture must be optimally engineered to handle concurrently high loads, scaling to accommodate large request volumes with consistent sub-second REST API response times.
*   **Processing Latency:** Live transcription streams must render within a maximum latency window of 1–2 seconds, and post-meeting AI summaries must generate in near real-time relative to the total session duration.

### 4.4.2 Security and Sovereignty
*   **Data Localisation:** Absolute adherence to 100% private data handling principles. The system must operate independently of external API dependencies.
*   **Vulnerability Mitigation:** The application must implement rigorous enterprise-grade protections, including persistent sanitisation against cross-site scripting (XSS), robust SQL injection prevention parameters, and automatic JWT (JSON Web Token) validation.

### 4.4.3 Usability and Interface Design
*   **Cognitive Load:** The web frontend must leverage an intuitive, highly responsive "Frosted Aurora" aesthetic design methodology. Navigation pathways should be meticulously crafted to demand minimal cognitive effort from non-technical end users.

### 4.4.4 Scalability
*   **Microservices Architecture:** By utilising an entirely Dockerised environment (encapsulating independent LiveKit, Whispex, frontend, and backend containers), the project shall intrinsically support horizontal operational scalability. 

### 4.4.5 Reliability and Availability
*   **Hardware Agnosticism:** The implementation of both GPU-accelerated and CPU-optimised execution containers ensures robust algorithmic reliability across varying classifications of local hardware arrays.
*   **Data Persistence:** Persistent local volume integration ensures total data ownership and seamless archival recovery without external dependencies. 

## 4.5 Hardware and Software Requirements
To guarantee the stable and efficient operational execution of the video conferencing features alongside the computationally intensive local AI models, the foundational environments must satisfy strict baseline prerequisites.

### 4.5.1 Hardware Requirements

Hardware specifications are bifurcated into the minimum configuration required to run the core application, and the recommended specification to fully leverage local GPU AI acceleration.

**Table 4.1: Minimum & Recommended Hardware Requirements**

| Component | Minimum Specification (Basic CPU Processing) | Recommended Specification (GPU Accelerated) |
| :--- | :--- | :--- |
| **Processor (CPU)** | Intel Core i5 (8th Gen) / AMD Ryzen 5 or equivalent (4+ Cores) | Intel Core i7 / AMD Ryzen 7 (8+ Cores) or higher |
| **Memory (RAM)** | 8 GB DDR4 | 16 GB DDR4 (32 GB preferred for concurrent models) |
| **VGA / GPU** | Integrated Graphics (Intel UHD / AMD Vega) | Dedicated NVIDIA GPU with 8GB+ VRAM (e.g., RTX 3060+) or Apple Silicon (M1/M2/M3 Pro/Max) |
| **Storage Space** | 20 GB Free Space | 50 GB+ NVMe SSD (For high-speed model retrieval) |
| **Network** | 20 Mbps Broadband Connection | 50 Mbps+ Fibre Connection (crucial for hosting multiple WebRTC feeds) |

### 4.5.2 Software Requirements

The platform is designed to be largely platform-agnostic, provided the host machine possesses the necessary orchestration frameworks. 

**Table 4.2: Software Requirements**

| Component | Requirement / Supported Technologies |
| :--- | :--- |
| **Operating System** | Linux (Ubuntu 20.04+), macOS 12+ (Apple Silicon supported natively via Metal), or Windows 10/11 (with WSL2 enabled) |
| **Containerisation** | Docker Desktop v4.0.0 or higher / Docker Engine v20.10+ |
| **Orchestration** | Docker Compose v2.0+ |
| **Backend Environment** | Python 3.10+ (Framework: FastAPI) |
| **Frontend Environment** | Node.js v18.x+, Vite |
| **Web Browsers (Client)** | Google Chrome (v90+), Mozilla Firefox (v88+), Safari (v15+) |

### 4.5.3 Server Hosting Requirements
Whilst the platform can be deployed strictly locally, SpeakInsights features robust readiness for enterprise-grade deployment to facilitate usage by larger civic or cooperative clients.

*   **Cloud Hosting Infrastructure:** Compatible with major VPS or Cloud providers including AWS (Amazon Web Services), Microsoft Azure, or comprehensive self-hosted enterprise datacentres. 
*   **Compute Provisioning:** Virtual Private Server (VPS) configuration demanding dedicated vCPUs and scalable block RAM to accommodate asynchronous WebSocket and HTTP polling logic.
*   **Database Administration:** Native support for managed PostgreSQL deployments (e.g., AWS RDS, Azure Database for PostgreSQL) providing high-availability and vector extension integrations (`pgvector`).
*   **Elastic Scalability:** Utilisation of auto-scaling groups and orchestrated load balancing to intelligently counteract processing latency during peak meeting hour usage.
*   **Security & Redundancy:** Imperative SSL/TLS configuration forcing secure HTTPS tunneling. Regular snapshotting, alongside continuous firewall and basic Intrusion Detection System (IDS) oversight.

## 4.6 External Interface Requirements
To ensure seamless interactions between the user, the operating environment, and the application components, specific interface requirements must be established.

### 4.6.1 User Interfaces (UI)
*   The application shall provide a responsive web interface designed using Tailwind CSS, ensuring compatibility across diverse viewport sizes (desktops, tablets, and smartphones).
*   The video conferencing dashboard must adopt a distraction-free layout (the "Frosted Aurora" aesthetic), presenting essential controls (mute, camera toggle, screen share) visibly within the user's primary field of view.
*   Administrative dashboards must prominently exhibit system health metrics, active container statuses, and local AI model performance indicators.

### 4.6.2 Software Interfaces
*   **Database Interface:** The system must interface seamlessly with PostgreSQL via SQLAlchemy (ORM) and utilise `pgvector` for embedding storage and retrieval.
*   **AI Model Interface:** The backend will interface locally with OpenAI WhisperX for audio transcription and local LLMs (via Ollama or vLLM) using strictly local API calls over the internal Docker network.
*   **WebRTC Interface:** The frontend and backend components must continuously communicate with the LiveKit SFU instance to facilitate real-time audio and video relay.

### 4.6.3 Communication Interfaces
*   **Protocols:** Standard HTTP/HTTPS via RESTful APIs for static data transactions and authentication.
*   **Real-Time Bi-Directional:** Secure WebSockets (WSS) must be utilised for real-time live captions, RAG chat querying, and instantaneous meeting status updates.
*   **Media Transport:** SRTP (Secure Real-Time Transport Protocol) coupled with TURN/STUN servers ensures the secure, low-latency transmission of UDP media packets across NATs and firewalls.

## 4.7 System Constraints and Assumptions
The successful implementation and operation of SpeakInsights are governed by a set of explicit constraints and technological assumptions.

### 4.7.1 Technical Constraints
*   **Computational Bottlenecks:** Live, local AI inference (particularly ASR and robust LLM summarisation) is constrained by the host machine's hardware capabilities. Basic CPU-only setups will face latency compared to GPU-accelerated nodes.
*   **Container Limits:** Deployments are locked to containerised environments via Docker, mandating its installation on host machines.

### 4.7.2 Operational Assumptions
*   **Network Stability:** It is assumed that the deployment environment maintains stable, consistent internal network routing or adequate bandwidth if deployed on a cloud VPS.
*   **User Devices:** End users are assumed to utilise modern web browsers with enabled permissions for microphones and webcams.
*   **Language Parameters:** Initial transcription and semantic intelligence are primarily optimised for English language nuances, subject to the inherent training biases of the foundational models.

## 4.8 Feasibility Analysis
Assessing the viability of the proposed system is paramount before initiating full-scale development. SpeakInsights aligns favourably across three prominent feasibility metrics.

### 4.8.1 Technical Feasibility
The project harnesses mature, open-source technology stacks including modern Python (FastAPI), React (Vite), and established open-weights AI models. Containerisation via Docker guarantees reproducibility. The requisite technologies are readily available, well-documented, and actively maintained, rendering the project highly technically feasible.

### 4.8.2 Economic Feasibility
By pivoting completely to open-source models (WhisperX, local LLMs) and discarding inherently costly API subscriptions (e.g., paid OpenAI API tiers), SpeakInsights dramatically curtails operational expenses. The initial investment is entirely relegated to the procurement or leasing of capable computing hardware, making it exceptionally economical for long-term enterprise use.

### 4.8.3 Operational Feasibility
From an operational standpoint, the transition to the SpeakInsights platform requires minimal organisational shifts. It replaces disparate cloud-based solutions with a unified, private hub. By automating the labour-intensive tasks of minuting and action item extraction, it profoundly augments workforce productivity and ensures steadfast adoption.