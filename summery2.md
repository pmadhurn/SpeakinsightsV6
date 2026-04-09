Here is a completely revamped, highly professional **Chapter 2: Literature Survey** tailored for a Final Year Project report. 

The original text confused a "Literature Survey" (which academically means reviewing existing research, technologies, and competitor systems to find a gap) with a literal "Survey Feature." I have completely rewritten this chapter to match the academic standard of a computer science/engineering final year project report. It now comprehensively covers the evolution of video conferencing, ASR (Automatic Speech Recognition), Large Language Models (LLMs), privacy concerns, and a comparison with existing platforms like Zoom and Otter.ai.

You can directly copy and paste this into your Google Docs.

***

# Chapter 2
# Literature Survey

## 2.1 Introduction
The rapid global transition to remote and hybrid work paradigms has positioned video conferencing and online collaboration tools as critical infrastructure for modern enterprises. Concurrently, the explosion of Artificial Intelligence (AI) and Natural Language Processing (NLP) has birthed a new domain: **Meeting Intelligence**. Organizations no longer just want to host meetings; they want to automatically transcribe, summarize, extract action items, and analyze the sentiment of these interactions. 

However, current market solutions suffer from functional fragmentation and severe data privacy vulnerabilities. This literature survey reviews the technological pillars underlying meeting intelligence—including WebRTC, Selective Forwarding Units (SFUs), Automatic Speech Recognition (ASR), and Large Language Models (LLMs)—and critically analyzes existing solutions to highlight the architectural gaps that **SpeakInsights** resolves.

## 2.2 Evolution of Real-Time Communication (RTC)
The foundation of modern browser-based video conferencing is **WebRTC (Web Real-Time Communication)**, an open-source project introduced in 2011 to enable peer-to-peer audio, video, and data sharing without third-party plugins. 
As meeting participant numbers scale up, purely peer-to-peer (Mesh) networks suffer from exponential bandwidth degradation. To solve this, literature heavily favors the **Selective Forwarding Unit (SFU)** architecture over traditional Multipoint Control Units (MCUs). 
* **MCUs:** Decode, mix, and re-encode streams before distributing them. This is highly CPU-intensive and introduces significant latency.
* **SFUs (e.g., LiveKit, Mediasoup):** Receive multiple media streams from endpoints and selectively forward them to other participants without computational-heavy decoding. SpeakInsights adopts the LiveKit SFU infrastructure, allowing for highly efficient stream routing, fallback mechanisms (TCP/WSS over UDP), and fundamentally supporting **track isolation**—where individual participant audio tracks can be recorded separately for flawless downstream identification without complex AI speaker diarization.

## 2.3 Automatic Speech Recognition (ASR)
The extraction of actionable intelligence begins with accurate transcription. Traditional ASR models relied on acoustic Hidden Markov Models (HMMs) combined with statistical language models. However, the introduction of Transformer network architectures revolutionalized sequence-to-sequence audio modeling.

OpenAI’s **Whisper** model represents the state-of-the-art in open-weight general-purpose speech recognition, trained on 680,000 hours of multilingual data. According to recent benchmarks, Whisper achieves near-human parity in Word Error Rate (WER) across varying accents and background noise levels. 
To enhance Whisper for enterprise meeting analytics, extensions like **WhisperX** incorporate Voice Activity Detection (VAD) and forced phoneme alignment. This produces highly precise timestamped transcriptions, a prerequisite for synchronized playback and chronological sentiment timeline mapping, forms the foundational transcription layer of the SpeakInsights pipeline.

## 2.4 Natural Language Processing and Meeting Intelligence
Once text is extracted, deriving meaning requires robust semantic computation. Traditional NLP methods (like TF-IDF or textrank algorithms) struggled with the conversational, non-linear, and often disjointed nature of human speech. 
The advent of **Large Language Models (LLMs)**—such as Llama 3, GPT-4, and Claude—has solved these analytical hurdles. 
* **Summarization & Task Extraction:** LLMs utilize self-attention mechanisms to construct highly accurate executive summaries and identify explicit / implicit action items (Task, Assignee, Priority, Due Date) from unstructured meeting corpora.
* **Sentiment Analysis:** Combining LLM reasoning with specialized lexicon-based analyzers (such as VADER - *Valence Aware Dictionary and sEntiment Reasoner*) allows for granular, utterance-level positive, negative, and neutral emotion scoring, mapping the "mood" of a meeting.
* **Retrieval-Augmented Generation (RAG):** Instead of fine-tuning models on meeting data, passing highly relevant vectorized transcript chunks (using embeddings like `nomic-embed-text` stored in a `pgvector` database) into an LLM context window provides accurate, hallucination-free querying of historical meeting records.

## 2.5 Security, Privacy, and Data Sovereignty in AI
A recurring theme in modern cybersecurity literature is the concept of "Data Sovereignty"—the requirement that sensitive corporate data remains within controlled IT perimeters. Currently, passing private boardroom negotiations, healthcare consultations, or financial strategy discussions through third-party cloud AI APIs (like OpenAI) constitutes a significant compliance breach under regulations such as GDPR, HIPAA, and CCPA.
Current literature emphasizes the necessity of **On-Premise or Localized AI Inference**. By utilizing localized model engines (such as **Ollama**) to execute modern open-weights models (e.g., Llama 3.2), organizations can decouple analytical intelligence from external data transmission, ensuring absolute data sovereignty. 

## 2.6 Comparative Analysis of Existing Solutions

| Platform / Tool | Core Capabilities | Major Limitations / Gaps Identified |
| :--- | :--- | :--- |
| **Zoom / MS Teams** | Audio/Video conferencing, native generic summaries (Copilot/Zoom AI). | Closed ecosystems. Expensive premium licensing for AI features. Data is ingested into corporate vendor clouds, risking privacy. |
| **Otter.ai / Fireflies.ai** | Great transcription, meeting summaries, task generation. | Relies on invasive "bot" participants joining calls. Fragments the workflow (video on one app, intelligence on another). Transmits proprietary data outside the host network. |
| **Google Meet** | WebRTC-based conferencing, basic live captions. | Lacks comprehensive local RAG integrations, and deep sentiment analysis timelines. Analytics are deeply tied to the Google Workspace ecosystem. |
| **SpeakInsights** | WebRTC video (LiveKit), VAD-aligned ASR (WhisperX), LLM intelligence, Local RAG, VADER Sentiment Timeline. | **Solves existing market gaps:** Merges a scalable SFU with local ASR and LLMs into a **single, Dockerized, privacy-first platform**. Data never leaves the deployment boundary. |

## 2.7 Conclusion and Problem Alignment
The literature review clearly indicates a paradigm shift: while the fundamental technologies to facilitate real-time video communication (WebRTC/SFU) and advanced multi-modal intelligence (WhisperX/Local LLMs) exist, they are currently fragmented. Businesses are forced to choose between highly intelligent, privacy-compromising cloud SaaS platforms, or secure, analog communication methods.

There is a distinct, unmet need for a unified, self-hosted architectural framework that combines the accessibility of a modern video conference hub with the state-of-the-art analytical power of local AI models. **SpeakInsights** is architected specifically to bridge this gap, ensuring that advanced meeting intelligence and absolute data privacy can seamlessly coexist.

