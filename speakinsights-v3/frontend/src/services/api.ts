import axios from 'axios';
import type { Meeting, CreateMeetingRequest, CreateMeetingResponse, JoinResponse } from '@/types/meeting';
import type { TranscriptSegment, TranscriptTimeline, TranscriptSearchResult } from '@/types/transcription';
import type { Summary, Task, SentimentData } from '@/types/summary';
import type { ChatMessage, ChatSession, ChatRequest } from '@/types/chat';

// ─── Axios Instance ───
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Error interceptor
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'Something went wrong';
    console.error('[API Error]', msg);
    return Promise.reject(err);
  }
);

// ─── Meetings ───
export const meetings = {
  create: (data: CreateMeetingRequest) =>
    api.post<CreateMeetingResponse>('/meetings', data).then((r) => r.data),

  list: () =>
    api.get<{ meetings: Meeting[] }>('/meetings', { params: { limit: 500 } }).then((r) => r.data.meetings),

  get: (id: string) =>
    api.get<Meeting>(`/meetings/${id}`).then((r) => r.data),

  getByCode: (code: string) =>
    api.get<Meeting>(`/meetings/code/${code}`).then((r) => r.data),

  join: (meetingId: string, displayName: string) =>
    api.post<JoinResponse>(`/meetings/${meetingId}/join`, { display_name: displayName }).then((r) => r.data),

  approve: (meetingId: string, participantId: string) =>
    api.post(`/meetings/${meetingId}/approve/${participantId}`).then((r) => r.data),

  decline: (meetingId: string, participantId: string) =>
    api.post(`/meetings/${meetingId}/decline/${participantId}`).then((r) => r.data),

  start: (id: string) =>
    api.post(`/meetings/${id}/start`).then((r) => r.data),

  end: (id: string) =>
    api.post(`/meetings/${id}/end`).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/meetings/${id}`).then((r) => r.data),

  kick: (meetingId: string, participantIdentity: string) =>
    api.post(`/meetings/${meetingId}/kick/${encodeURIComponent(participantIdentity)}`).then((r) => r.data),

  retranscribe: (meetingId: string) =>
    api.post(`/meetings/${meetingId}/retranscribe`, {}, { timeout: 60000 }).then((r) => r.data),

  stopProcessing: (meetingId: string) =>
    api.post(`/meetings/${meetingId}/stop-processing`).then((r) => r.data),
};

// ─── Transcriptions ───
export const transcriptions = {
  getTranscript: (meetingId: string) =>
    api.get<{ segments: TranscriptSegment[] }>(`/transcriptions/${meetingId}`).then((r) => r.data.segments || []),

  getTimeline: (meetingId: string) =>
    api.get<TranscriptTimeline>(`/transcriptions/${meetingId}/timeline`).then((r) => r.data),

  search: (meetingId: string, query: string) =>
    api.get<{ results: TranscriptSearchResult[]; query: string; meeting_id: string; count: number }>(
      `/transcriptions/${meetingId}/search`,
      { params: { q: query } }
    ).then((r) => r.data.results || []),

  renameSpeakers: (meetingId: string, renames: Record<string, string>) =>
    api.patch(`/transcriptions/${meetingId}/speakers/rename`, { renames }).then((r) => r.data),
};

// ─── Summaries ───

// The backend returns an array of SummaryResponse objects (executive, key_points,
// decisions, sentiment), each with summary_type + content + structured_data.
// The frontend Summary type expects a single flat object.
interface BackendSummaryResponse {
  id: string;
  meeting_id: string;
  summary_type: string;
  content: string | null;
  structured_data: Record<string, unknown> | null;
  model_used: string | null;
  created_at: string;
}

function transformSummaryResponse(items: BackendSummaryResponse[]): Summary | null {
  if (!items || items.length === 0) return null;

  const exec = items.find((s) => s.summary_type === 'executive');
  const kp = items.find((s) => s.summary_type === 'key_points');
  const dec = items.find((s) => s.summary_type === 'decisions');

  // Extract from structured_data first, fall back to content
  const execSummary =
    (exec?.structured_data?.executive_summary as string) ||
    exec?.content ||
    '';

  const keyPoints: string[] =
    (exec?.structured_data?.key_points as string[]) ||
    (kp?.structured_data?.key_points as string[]) ||
    (kp?.content ? kp.content.split('\n').filter(Boolean) : []);

  const decisions: string[] =
    (exec?.structured_data?.decisions_made as string[]) ||
    (dec?.structured_data?.decisions_made as string[]) ||
    (dec?.content ? dec.content.split('\n').filter(Boolean) : []);

  const keywords: string[] =
    (exec?.structured_data?.keywords as string[]) || [];

  const topics: string[] =
    (exec?.structured_data?.topics as string[]) || [];

  const themes: string[] =
    (exec?.structured_data?.themes as string[]) || [];

  const base = exec || items[0];
  return {
    id: base.id,
    meeting_id: base.meeting_id,
    executive_summary: execSummary,
    key_points: keyPoints,
    decisions: decisions,
    keywords: keywords,
    topics: topics,
    themes: themes,
    model_used: base.model_used || '',
    created_at: base.created_at,
  };
}

export const summaries = {
  generate: (meetingId: string, model?: string) =>
    api
      .post<BackendSummaryResponse[]>(`/summaries/${meetingId}/generate`, { model }, { timeout: 120000 })
      .then((r) => transformSummaryResponse(r.data)),

  get: (meetingId: string) =>
    api
      .get<BackendSummaryResponse[]>(`/summaries/${meetingId}`)
      .then((r) => transformSummaryResponse(r.data)),

  getTasks: (meetingId: string) =>
    api.get<Task[]>(`/summaries/${meetingId}/tasks`).then((r) => r.data),

  updateTask: (meetingId: string, taskId: string, data: Partial<Task>) =>
    api.put<Task>(`/summaries/tasks/${taskId}`, data).then((r) => r.data),

  getSentiment: (meetingId: string) =>
    api.get<SentimentData>(`/summaries/${meetingId}/sentiment`).then((r) => r.data),
};

// ─── Recordings ───
export const recordings = {
  list: (meetingId: string) =>
    api.get(`/recordings/${meetingId}`).then((r) => r.data),

  getCompositeUrl: (meetingId: string) =>
    api.get<{ url: string }>(`/recordings/${meetingId}/composite`).then((r) => r.data),

  getTracks: (meetingId: string) =>
    api.get(`/recordings/${meetingId}/tracks`).then((r) => r.data),

  getDownloadUrl: (meetingId: string, recordingId?: string) =>
    `/api/recordings/${meetingId}/download${recordingId ? `/${recordingId}` : ''}`,
};

// ─── Calendar ───
export const calendar = {
  export: (meetingId: string) =>
    api.post(`/calendar/${meetingId}/export`).then((r) => r.data),

  getIcs: (meetingId: string) =>
    api.get(`/calendar/${meetingId}/ics`, { responseType: 'blob' }).then((r) => r.data),
};

// ─── Chat ───
export const chat = {
  send: (data: ChatRequest) =>
    api.post<ChatMessage>('/chat', data).then((r) => r.data),

  getHistory: (sessionId: string) =>
    api.get(`/chat/history/${sessionId}`).then((r) => r.data),

  getSessions: () =>
    api.get('/chat/sessions').then((r) => r.data),

  deleteSession: (sessionId: string) =>
    api.delete(`/chat/history/${sessionId}`).then((r) => r.data),
};

// ─── Models (Ollama) ───
export const models = {
  list: () =>
    api.get('/models/').then((r) => r.data),

  pull: (name: string) =>
    api.post('/models/pull', { name }).then((r) => r.data),

  delete: (name: string) =>
    api.delete(`/models/${name}`).then((r) => r.data),

  getInfo: (name: string) =>
    api.get(`/models/${name}`).then((r) => r.data),
};

// ─── LLM Settings ───
export const llmSettings = {
  get: () =>
    api.get('/llm').then((r) => r.data),

  setProvider: (provider: string, openrouterModel?: string) =>
    api.put('/llm/provider', { provider, openrouter_model: openrouterModel }).then((r) => r.data),

  getOpenRouterModels: () =>
    api.get('/llm/openrouter/models').then((r) => r.data),
};

// ─── Upload ───
export const upload = {
  meeting: (file: File, title: string, hostName?: string, language?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    if (hostName) formData.append('host_name', hostName);
    if (language) formData.append('language', language);

    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,  // 2 min for large uploads
    }).then((r) => r.data);
  },
};

export default api;
