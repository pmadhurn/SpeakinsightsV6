# Chapter 3
# Project Management

## 3.1 Project Planning & Objectives

The primary aim of project planning is to orchestrate, manage, and continuously monitor the development lifecycle of SpeakInsights. This ensures that the meeting intelligence platform is delivered within the stipulated timeframe, adheres to stringent quality standards, and provides a seamless, intuitive user experience. Effective project management guarantees that resources are allocated optimally, potential risks are proactively identified and mitigated, and all core architectural and functional objectives are successfully realised.

**Core Project Objectives:**
* **Scope Definition:** Clearly outline the software's boundaries, core features, and anticipated functional capabilities.
* **Resource Management:** Assign and judiciously manage human, software, and hardware resources to maximise productivity.
* **Methodology Selection:** Adopt a structured, iterative development approach (Agile) to construct a reliable, scalable, and maintainable platform.
* **Quality Assurance:** Ensure timely delivery, high-calibre system performance, robust data security, and end-user satisfaction.

## 3.2 Software Scope

The software scope delineates the functional boundaries and paramount deliverables for the SpeakInsights ecosystem:
* Facilitation, management, and hosting of multi-user video meetings accommodating up to 20 concurrent participants.
* Low-latency, real-time video and audio streaming driven by WebRTC and the LiveKit Selective Forwarding Unit (SFU).
* AI-powered, real-time speech-to-text transcription utilising WhisperX, complete with accurate speaker attribution.
* Post-meeting executive summarisation and automated task extraction driven by local Large Language Models (LLMs) via Ollama.
* Granular sentiment analysis of conversations to derive actionable organisational insights.
* Secure, structured storage of meeting archives, transcripts, and AI-generated text embeddings within PostgreSQL (enhanced with `pgvector`).
* Robust user authentication and Role-Based Access Control (RBAC) distinguishing between administrators, organisers, and standard participants.
* A responsive, modern User Interface (UI) adopting the "Frosted Aurora" glassmorphism design language, fully accessible across desktops, tablets, and mobile web browsers.
* Seamless ecosystem integration including calendar exports (.ics format) and real-time chat augmented by Retrieval-Augmented Generation (RAG) AI assistance.

## 3.3 Resource Management

Efficient resource allocation is fundamentally critical to the project's viability. Resources are categorised as follows:

### 3.3.1 Human Resources
Given the lean two-person project team, responsibilities are logically bifurcated:
* **Full-Stack & Backend Lead:** Oversees the project timeline, backend server logic (FastAPI), database architecture (PostgreSQL/pgvector), and the integration of AI modules (WhisperX, Ollama). Ensures API scalability and data security.
* **Frontend & UX/UI Lead:** Directs the architectural design of the interface using React and Tailwind CSS, manages state logic (Zustand), and ensures responsive, cross-platform compatibility. Handles frontend integration testing and visual QA.

### 3.3.2 Software Resources
* **Frameworks & Libraries:** React 18, TypeScript, Tailwind CSS, FastAPI, SQLAlchemy, LiveKit SDK, WhisperX, Ollama.
* **Version Control & Collaboration:** Git, GitHub for repository hosting and CI/CD pipelines.
* **Supporting Infrastructure:** Docker and Docker Compose for robust container orchestration, Redis for caching and message queuing, Nginx for reverse proxy routing.

### 3.3.3 Environment Resources
* **Development Environment:** Visual Studio Code, Node.js environment, Python 3.11+.
* **Operating Systems:** Cross-platform development targeting Windows, macOS, and Linux sub-systems.
* **Deployment Infrastructure:** Docker Desktop for local testing; highly available cloud instances with GPU acceleration for hosting AI inference models.

## 3.4 Project Development Approach

The SpeakInsights project adopts an Agile-inspired, iterative, and incremental development methodology. This approach is highly suited for software requiring complex AI integrations, as it accommodates evolving requirements and continuous testing:
1. **Requirement Analysis:** Comprehensive gathering of functional and non-functional specifications from academic and system stakeholders.
2. **Architectural Design:** Prototyping UI/UX wireframes, detailing relational database schemas, and mapping backend microservice communications.
3. **Iterative Development (Sprints):** Phased implementation of frontend components, backend high-performance APIs, and AI integrations in manageable two-week cycles.
4. **Continuous Testing:** Integration of unit testing, component functional testing, and user acceptance testing (UAT) at the conclusion of each iteration to immediately rectify defects.
5. **Deployment & Review:** Containerised deployment via Docker, facilitating rapid user feedback loops and subsequent performance optimisations.

## 3.5 Project Scheduling

Meticulous project scheduling ensures that all development activities for SpeakInsights are planned, executed, and validated within the academic timeframe. 

### 3.5.1 Work Breakdown Structure (WBS)
To streamline execution, the system architecture is compartmentalised into distinct modules:
* **Frontend Module:** React.js and TypeScript integration for participant dashboards, meeting rooms, and chat interfaces.
* **Backend Module:** FastAPI endpoints governing authentication, WebSocket orchestration for real-time chat, and AI service middleware.
* **Database & Caching Module:** Implementation of PostgreSQL with `pgvector` for embedding storage, and Redis for volatile in-memory operations.
* **AI Integration Module:** Pipeline construction for WhisperX transcriptions and Ollama-based processing (summarisation and RAG).
* **DevOps Module:** Dockerisation of the full stack, Nginx configuration, and cross-OS environment parity.

### 3.5.2 Timeline and Time Allocation
The project schedule is structured over a 10-week lifecycle, progressively transitioning from theoretical design to robust deployment:

| Development Phase | Duration | Start Week | End Week | Key Deliverables |
| :--- | :--- | :--- | :--- | :--- |
| Requirement Analysis | 1–2 weeks | Week 1 | Week 2 | System Requirements Specification (SRS), Feasibility Study. |
| System Design | 2 weeks | Week 2 | Week 4 | UI Wireframes, Database Schema, API Contracts. |
| Core Backend Development | 3 weeks | Week 4 | Week 7 | FastAPI implementation, Auth, LiveKit WebRTC bridging. |
| Core Frontend Development | 3 weeks | Week 4 | Week 7 | React components, State management, Responsive CSS. |
| Database & AI Integration | 2 weeks | Week 5 | Week 7 | Postgres setup, Ollama & WhisperX pipeline orchestration. |
| Testing & QA | 2 weeks | Week 7 | Week 9 | Unit, Integration, and System load testing. |
| Deployment & Feedback | 1 week | Week 10 | Week 10 | Docker compose launch, Bug resolution, Final documentation. |

*(Table 3.1: Project Time Allocation Table)*

## 3.6 Team Organisation & Responsibilities

For optimal efficiency, execution is strictly divided into domain-specific leadership roles, establishing clear accountability:

**1. Team Member 1 – Full-Stack & Backend Lead**
* Designs and constructs the server-side architecture (FastAPI) and API routing mechanisms.
* Engineers the database schemas (PostgreSQL) and implements vector storage for AI embeddings (`pgvector`).
* Integrates machine learning microservices (WhisperX, Ollama, Sentiment Analysis).
* Manages secure data handling, data sovereignty adherence, and real-time WebSockets integration.

**2. Team Member 2 – Frontend & UX/UI Lead**
* Authors the user-facing application utilising React.js, TypeScript, and Tailwind CSS.
* Translates UI/UX wireframes into functional, accessible "Frosted Aurora" design components.
* Integrates frontend stores (Zustand) with backend RESTful and WebSocket endpoints.
* Conducts client-side performance profiling and ensures cross-browser stability.

**Shared Responsibilities:**
* **Quality Assurance:** Both members engage in rigorous peer-reviewing, integration testing, and bug-squashing.
* **Documentation:** Collaborative authoring of the project report, technical manuals, and architectural diagrams.
* **DevOps:** Joint management of the Dockerised environment and deployment workflows.

## 3.7 Risk Management

Identifying, evaluating, and mitigating risk is pivotal, particularly given the computationally intensive nature of AI models and the strict latency requirements of real-time video conferencing.

### 3.7.1 Technical Risks
**Risk:** Failure or unacceptable latency in real-time automated speech recognition (ASR).
* **Impact:** Severe degradation of user experience and compromised accuracy of post-meeting intelligence.
* **Mitigation:** Utilise the highly optimised WhisperX framework with appropriate batching. Implement robust fallback mechanisms, such as decoupled asynchronous transcription processing if real-time CPU/GPU load exceeds threshold limits.

**Risk:** Infrastructure bottlenecks during multi-participant (10+ users) video streams.
* **Impact:** Frame drops, audio desynchronisation, and application crashes.
* **Mitigation:** Leverage LiveKit as a Selective Forwarding Unit (SFU) rather than a Multipoint Control Unit (MCU), dramatically reducing server-side payload processing.

### 3.7.2 Data Privacy & Security Risks
**Risk:** Unauthorised interception of sensitive meeting video or transcription data.
* **Impact:** Critical breach of privacy, erosion of trust, and potential regulatory compliance failures.
* **Mitigation:** Enforce stringent token-based authentication (JWT). Guarantee that all local AI execution (Ollama/WhisperX) is air-gapped from public cloud analytics, ensuring absolute data sovereignty. Secure data-at-rest within PostgreSQL.

### 3.7.3 Operational & Schedule Risks
**Risk:** Overestimation of team velocity resulting in missed milestones.
* **Impact:** Incomplete features at the time of final academic submission.
* **Mitigation:** Utilise Agile sprints with strict prioritisation of the MVP (Minimum Viable Product). Desirable but non-critical features (like mobile push notifications) are isolated as "Future Scope" to protect the core deliverables.

**Risk:** Dependency failures from external third-party APIs.
* **Impact:** Loss of core application functionality if external services alter pricing or suffer outages.
* **Mitigation:** SpeakInsights is deliberately engineered to use locally hosted, open-weights AI models (Whisper, Llama via Ollama), effectively eliminating third-party API dependency and ensuring long-term operational resilience.
