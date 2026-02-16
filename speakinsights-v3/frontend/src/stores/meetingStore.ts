import { create } from 'zustand';
import type { Meeting, Participant, LobbyParticipant } from '@/types/meeting';

interface MeetingState {
  currentMeeting: Meeting | null;
  meetings: Meeting[];
  participants: Participant[];
  lobbyParticipants: LobbyParticipant[];
  isLoading: boolean;
  isCreating: boolean;
  isJoining: boolean;
  error: string | null;

  // Actions
  setCurrentMeeting: (meeting: Meeting | null) => void;
  setMeetings: (meetings: Meeting[]) => void;
  addParticipant: (participant: Participant) => void;
  updateParticipantStatus: (id: string, status: Participant['status']) => void;
  removeParticipant: (id: string) => void;
  addLobbyParticipant: (p: LobbyParticipant) => void;
  removeLobbyParticipant: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setCreating: (creating: boolean) => void;
  setJoining: (joining: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  currentMeeting: null,
  meetings: [],
  participants: [],
  lobbyParticipants: [],
  isLoading: false,
  isCreating: false,
  isJoining: false,
  error: null,
};

export const useMeetingStore = create<MeetingState>((set) => ({
  ...initialState,

  setCurrentMeeting: (meeting) => set({ currentMeeting: meeting }),
  setMeetings: (meetings) => set({ meetings }),

  addParticipant: (participant) =>
    set((state) => ({
      participants: [...state.participants.filter((p) => p.id !== participant.id), participant],
    })),

  updateParticipantStatus: (id, status) =>
    set((state) => ({
      participants: state.participants.map((p) => (p.id === id ? { ...p, status } : p)),
    })),

  removeParticipant: (id) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== id),
    })),

  addLobbyParticipant: (p) =>
    set((state) => ({
      lobbyParticipants: [...state.lobbyParticipants.filter((lp) => lp.participant_id !== p.participant_id), p],
    })),

  removeLobbyParticipant: (id) =>
    set((state) => ({
      lobbyParticipants: state.lobbyParticipants.filter((p) => p.participant_id !== id),
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setCreating: (isCreating) => set({ isCreating }),
  setJoining: (isJoining) => set({ isJoining }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
