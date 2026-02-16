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
    api.get<{ meetings: Meeting[] }>('/meetings').then((r) => r.data.meetings),

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
};

// ─── Transcriptions ───
export const transcriptions = {
  getTranscript: (meetingId: string) =>
    api.get<TranscriptSegment[]>(`/transcriptions/${meetingId}`).then((r) => r.data),

  getTimeline: (meetingId: string) =>
    api.get<TranscriptTimeline>(`/transcriptions/${meetingId}/timeline`).then((r) => r.data),

  search: (meetingId: string, query: string) =>
    api.get<TranscriptSearchResult[]>(`/transcriptions/${meetingId}/search`, {
      params: { q: query },
    }).then((r) => r.data),
};

// ─── Summaries ───
export const summaries = {
  generate: (meetingId: string, model?: string) =>
    api.post<Summary>(`/summaries/${meetingId}/generate`, { model }).then((r) => r.data),

  get: (meetingId: string) =>
    api.get<Summary>(`/summaries/${meetingId}`).then((r) => r.data),

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

  sendStream: (data: ChatRequest): EventSource => {
    const params = new URLSearchParams();
    params.set('message', data.message);
    if (data.session_id) params.set('session_id', data.session_id);
    if (data.meeting_id) params.set('meeting_id', data.meeting_id);
    if (data.model) params.set('model', data.model);
    if (data.use_rag !== undefined) params.set('use_rag', String(data.use_rag));
    return new EventSource(`/api/chat/stream?${params.toString()}`);
  },

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

export default api;
