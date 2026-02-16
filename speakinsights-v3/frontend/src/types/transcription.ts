export interface Word {
  word: string;
  start: number;
  end: number;
  score?: number;
}

export interface Speaker {
  name: string;
  id: string;
  color?: string;
}

export interface TranscriptSegment {
  id: string;
  meeting_id: string;
  speaker_name: string;
  text: string;
  start_time: number;
  end_time: number;
  words?: Word[];
  sentiment_score?: number;
  sentiment_label?: string;
  is_live?: boolean;
  created_at: string;
}

export interface TranscriptTimeline {
  segments: TranscriptSegment[];
  speakers: Speaker[];
  duration: number;
}

export interface TranscriptSearchResult {
  segment: TranscriptSegment;
  score: number;
  highlight: string;
}
