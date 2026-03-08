export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in-progress' | 'completed';

export interface Summary {
  id: string;
  meeting_id: string;
  executive_summary: string;
  key_points: string[];
  decisions: string[];
  keywords: string[];
  topics: string[];
  themes: string[];
  model_used: string;
  created_at: string;
}

export interface Task {
  id: string;
  meeting_id: string;
  title: string;
  description?: string;
  assignee?: string;
  due_date?: string;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
}

export interface SentimentData {
  meeting_id: string;
  overall_score: number;
  overall_label: string;
  speakers: SpeakerSentiment[];
  sentiment_arc: SentimentArcPoint[];
}

export interface SpeakerSentiment {
  speaker_name: string;
  average_score: number;
  label: string;
  segment_count: number;
  sentiment_arc: SentimentArcPoint[];
}

export interface SentimentArcPoint {
  time: number;
  score: number;
}
