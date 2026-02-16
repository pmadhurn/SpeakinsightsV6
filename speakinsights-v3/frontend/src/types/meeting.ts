export type MeetingStatus = 'waiting' | 'active' | 'processing' | 'completed' | 'cancelled';
export type ParticipantStatus = 'pending' | 'approved' | 'declined' | 'in-meeting' | 'left';

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  code: string;
  language: string;
  status: MeetingStatus;
  host_name: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  duration?: number;
  participant_count: number;
}

export interface Participant {
  id: string;
  meeting_id: string;
  name: string;
  status: ParticipantStatus;
  joined_at?: string;
  left_at?: string;
  is_host: boolean;
}

export interface CreateMeetingRequest {
  title: string;
  description?: string;
  language: string;
  host_name: string;
}

export interface CreateMeetingResponse {
  id: string;
  title: string;
  description?: string;
  code: string;
  language: string;
  status: string;
  host_name: string;
  max_participants: number;
  started_at?: string;
  ended_at?: string;
  created_at: string;
  updated_at?: string;
  participant_count: number;
}

export interface JoinRequest {
  name: string;
  meeting_code: string;
}

export interface JoinResponse {
  participant_id?: string;
  token?: string;
  room_id?: string;
  livekit_url?: string;
  status?: 'pending' | 'approved' | 'waiting';
  message?: string;
}

export interface LobbyParticipant {
  participant_id: string;
  name: string;
  requested_at: string;
}
