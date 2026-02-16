export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  model?: string;
  created_at: string;
}

export interface ChatSource {
  segment_id: string;
  speaker_name: string;
  text: string;
  start_time: number;
  meeting_title?: string;
  score: number;
}

export interface ChatSession {
  id: string;
  title: string;
  meeting_id?: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  meeting_id?: string;
  model?: string;
  use_rag?: boolean;
}

export interface ChatStreamEvent {
  type: 'token' | 'source' | 'done' | 'error';
  content?: string;
  source?: ChatSource;
  error?: string;
}
