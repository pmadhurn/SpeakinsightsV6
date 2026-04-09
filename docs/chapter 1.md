Chapter 1
Introduction


PROJECT SUMMARY						
PROJECT PURPOSE						
PROJECT SCOPE						
OBJECTIVES							
TECHNOLOGY AND LITERATURE OVERVIEW	
SYNOPSIS								




	

1.1 PROJECT SUMMARY


SpeakInsights is an AI-powered meeting intelligence platform designed to transform spoken conversations into actionable data. The system provides a secure, local-first environment for users to transcribe, summarize, and analyze meetings without compromising sensitive information.

On the frontend, the application features a Live Meeting View and Smart Dashboards, allowing users to watch transcriptions in real-time and customize views for different teams. Users can generate One-Click Reports and access the platform from any device via a mobile-responsive interface.

The backend is powered by FastAPI, exposing high-performance APIs that handle over 40,000 requests per second. This layer manages asynchronous processing, built-in authentication, and automatic input validation to ensure sub-second response times and enterprise-grade security.

Transcription is handled by a self-hosted WhisperX service, providing speaker-attributed text in real-time or post-meeting. AI-powered summarization, task extraction, and RAG-based conversational queries are performed via Ollama LLM. LiveKit serves as the WebRTC SFU for low-latency video and audio streaming. PostgreSQL 16 (with pgvector) stores user, meeting, and transcript data, while Redis 7 provides caching and message queue support.

The platform offers additional features such as:
Recording meetings with playback capabilities.
Exporting meeting schedules as .ics files for Google Calendar integration.
Sentiment analysis via VADER (in-meeting) and Ollama (post-meeting).
Support for up to 20 participants per meeting.
Dockerized deployment across Mac and Windows, with GPU acceleration for AI services.
	

1.2 PROJECT PURPOSE




The purpose of the SpeakInsights project is to provide a unified, intelligent platform for conducting and managing multi-person meetings with advanced AI-driven features. Traditional meeting workflows often involve scattered communication channels, manual note-taking, and post-meeting follow-ups that are time-consuming and prone to errors. SpeakInsights addresses these challenges by consolidating real-time video conferencing, transcription, AI summarization, task extraction, and sentiment analysis into a single, seamless system.
By leveraging a modern, Dockerized architecture with React on the frontend, 
FastAPI on the backend,and AI services such as WhisperX and Ollama, the 
platform achieves:
Ease of Use for Participants – An intuitive, responsive React interface with real-time captions, RAG-powered chat, and drag-and-drop meeting management allows participants to join, interact, and follow discussions effortlessly. Users can access meetings from any browser without additional software installations.
Transparency and Accountability – Each meeting is recorded, transcribed, and stored with unique identifiers. Participants and organizers can view transcripts, AI-generated summaries, and extracted action items, ensuring clarity and accountability in collaborative decision-making.
Efficiency for Organizers – The backend provides RESTful APIs and WebSocket handlers for secure, real-time communication. Administrators can manage meetings, assign tasks, and analyze sentiment instantly, significantly reducing administrative overhead and follow-up delays.
Scalability and Future-Readiness – The Docker-based modular design, combined with a cross-platform stack (React + FastAPI + PostgreSQL + AI services), allows future enhancements such as mobile integration, push notifications, advanced analytics dashboards, or AI-driven meeting insights.
Enhanced Collaboration – Participants can interact via chat, receive real-time transcriptions, export meetings to calendar .ics files, and playback recorded sessions, creating a full-circle collaborative environment that supports informed decision-making and productivity.


1.3 PROJECT SCOPE



The scope of SpeakInsights encompasses all essential aspects of an AI-driven meeting management platform, from real-time video conferencing to post-meeting summarization, task extraction, and collaborative review, implemented using a modern React + FastAPI + PostgreSQL + AI services stack, fully Dockerized for cross-platform deployment.

User Scope (Meeting Participants)

Participants can register and log in securely via a web browser.
They can join or create meetings with up to 20 participants per session.
Users receive live captions during meetings via the Web Speech API, improving accessibility.
Participants can interact with the RAG-powered chat assistant to ask questions, search past meeting knowledge, or clarify points in real time.
After meetings, users can review transcripts, AI-generated summaries, and action items, and playback recordings.
The UI is responsive and visually modern (“Frosted Aurora” glassmorphism), working across desktops, tablets, and laptops.

Administrator  Scope (Organizers / Hosts)
Administrators can log in securely to manage meeting sessions and participants.
They can monitor active meetings, track participant engagement, and assign post-meeting tasks.
Admins have access to analytics dashboards showing sentiment trends, key discussion points, and task completion status.
They can export meeting schedules as .ics files for calendar integration and generate post-meeting reports.
Organizers can manage AI model settings (WhisperX transcription, Ollama summarization) and monitor system health across Dockerized services.



Functional Scope
Real-time video conferencing with WebRTC via LiveKit.
Live transcription with speaker attribution using WhisperX.
Post-meeting AI summarization and task extraction via Ollama.
Sentiment analysis in-meeting (VADER) and post-meeting (Ollama).
RAG-powered chat for knowledge retrieval and Q&A.
Recording and playback of meetings with persistent storage.
Calendar integration via .ics file export.
Persistent storage and retrieval of meetings, transcripts, tasks, and metadata 
in PostgreSQL .


Future Scope
Mobile app integration for iOS and Android.
Push notifications (email/SMS/app) for meeting reminders, task assignments, and summary alerts.
Advanced analytics dashboards to detect participation patterns, meeting trends, or sentiment insights.
AI-driven meeting assistance, such as automated agenda generation, priority task highlighting, and topic clustering.
Integration with third-party services or corporate communication tools for enterprise-scale collaboration.

	

1.4 OBJECTIVES




Functional Objectives

Simplify Meeting Management
 Provide participants and organizers with an intuitive web interface to create, join, and manage meetings efficiently, ensuring seamless collaboration for up to 20 participants per session.

Enable Multimedia Interaction
 Support live video, audio, and text chat interactions during meetings. Allow participants to share screen content, receive live captions, and interact with AI-driven chat assistants for instant Q&A or knowledge retrieval.

Provide Real-Time Transcription & Summarization
 Offer speaker-attributed transcription using WhisperX and generate AI-powered meeting summaries and actionable tasks post-meeting via Ollama, enabling participants to review and act on key points efficiently.

Streamline Organizer Oversight
 Provide administrators with dashboards to monitor live meetings, track participation, assign tasks, and analyze sentiment or engagement trends.

Ensure Transparency & Accountability
 Maintain persistent storage of meeting recordings, transcripts, summaries, and action items, allowing participants and organizers to access historical records for clarity and audit purposes

Technical Objectives
Implement Full-Stack Modern Architecture
 Use React 18 + TypeScript + Vite + TailwindCSS for the frontend, FastAPI for the backend, and PostgreSQL 16 (with pgvector) for scalable, structured storage of meetings, transcripts, and AI embeddings.

Secure Authentication & Access Control
 Implement secure user and admin login sessions with token-based authentication (JWT) and role-based access to ensure privacy and secure management of meetings and AI services.

Responsive, Cross-Platform Design
 Ensure the UI works seamlessly across desktops, tablets, and laptops with modern glassmorphism styling (“Frosted Aurora”), while all core services run in a Dockerized environment for cross-platform compatibility (Mac/Windows).

Efficient Data Handling & Scalability
 Enable real-time streaming via LiveKit SFU, caching via Redis, and AI processing via Dockerized WhisperX and Ollama services to handle concurrent users efficiently and scale horizontally as needed.

Support for Future Enhancements
 Design the system for easy extension with mobile applications, push notifications, multilingual transcription, advanced analytics dashboards, and AI-driven meeting insights or prioritization.


	
1.5 TECHNOLOGY & LITERATURE OVERVIEW



SpeakInsights is developed using a modern, full-stack architecture that combines React 18 + TypeScript + Vite + TailwindCSS on the frontend with FastAPI (Python 3.11) on the backend. The system leverages PostgreSQL 16 (with pgvector) for structured data and embedding storage, Redis 7 for caching and message queues, and Docker Compose for containerized deployment. The modular architecture ensures scalability, security, and cross-platform compatibility.

React + Vite + TailwindCSS (Frontend):
 Builds a responsive, component-based UI with modern “Frosted Aurora” glassmorphism styling. Handles live captions, real-time chat, meeting playback, and AI-driven interactions.
FastAPI (Backend):
 Provides RESTful APIs and WebSocket endpoints for real-time video, chat, transcription, and AI services. Handles authentication, meeting management, task assignment, and sentiment analysis efficiently.
PostgreSQL + pgvector (Database):
 Stores meeting data, transcripts, AI embeddings, user profiles, and task metadata in a scalable, query-optimized format.
LiveKit (WebRTC SFU):
 Facilitates low-latency, multi-user video and audio streaming for up to 20 participants per session.
WhisperX (Transcription Service):
 Provides real-time and post-meeting speech-to-text transcription with speaker attribution.
Ollama (LLM Inference):
 Performs AI summarization, task extraction, and RAG-powered conversational queries.
Redis (Cache & Messaging):
 Handles transient message queues, real-time chat buffering, and performance optimization.
Authentication & Security:
 Token-based authentication (JWT) ensures secure access for users and administrators. Sensitive environment variables are managed via Docker and .env files.
Deployment:
 Fully containerized services enable deployment on Mac, Windows, or cloud platforms, with GPU acceleration for AI services where available.

Literature Overview
Digital transformation in professional collaboration and productivity tools has shown that AI-enhanced meeting platforms can significantly improve efficiency, information retention, and decision-making. Studies in organizational productivity emphasize that features such as real-time transcription, automated summarization, and task extraction reduce meeting overhead and increase actionable outcomes.
Global examples include:
Otter.ai: Provides live transcription and collaborative meeting notes for organizations worldwide.
Fireflies.ai: Automates meeting summaries and task extraction using AI for distributed teams.
Microsoft Teams + Viva Insights: Uses AI to generate meeting insights, track participation, and suggest follow-up actions.
These platforms highlight the impact of AI on enhancing remote collaboration. SpeakInsights builds on these principles, integrating open-source services like LiveKit and WhisperX, with a custom LLM-based workflow via Ollama, ensuring a scalable, secure, and modern solution optimized for real-time multi-user meetings.


	

1.6 SYNOPSIS




SpeakInsights is a Docker-deployable, full-featured AI-powered meeting platform designed to streamline multi-person collaboration, enhance productivity, and improve post-meeting follow-up. Built using React 18 + TypeScript + Vite + TailwindCSS for the frontend and FastAPI + PostgreSQL for the backend, the platform integrates AI services like WhisperX for real-time transcription and Ollama for summarization and task extraction.
Participants can join meetings with up to 20 users, access live captions, interact via a RAG-powered chat, and share audio, video, and text in real time. The platform automatically generates speaker-attributed transcripts, AI-driven summaries, and actionable tasks immediately after the meeting. Recorded meetings and AI insights are stored securely for future review.

Organizers and administrators have access to a comprehensive dashboard to monitor live meetings, assign tasks, analyze sentiment trends, and export schedules as .ics files. The system’s responsive “Frosted Aurora” UI ensures usability across desktops, laptops, and tablets
By combining modern web technologies with cutting-edge AI capabilities, SpeakInsights improves information retention, enhances decision-making, and fosters accountability among participants. Its modular and scalable architecture allows future expansions, such as mobile apps, push notifications, multilingual support, and advanced AI-driven meeting analytics.

