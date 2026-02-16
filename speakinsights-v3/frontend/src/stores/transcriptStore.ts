import { create } from 'zustand';
import type { TranscriptSegment } from '@/types/transcription';

interface TranscriptState {
  segments: TranscriptSegment[];
  liveCaption: string;
  activeSpeaker: string | null;
  isLoading: boolean;

  // Actions
  addSegment: (segment: TranscriptSegment) => void;
  setSegments: (segments: TranscriptSegment[]) => void;
  setLiveCaption: (caption: string) => void;
  setActiveSpeaker: (speaker: string | null) => void;
  setLoading: (loading: boolean) => void;
  clearTranscript: () => void;
}

export const useTranscriptStore = create<TranscriptState>((set) => ({
  segments: [],
  liveCaption: '',
  activeSpeaker: null,
  isLoading: false,

  addSegment: (segment) =>
    set((state) => ({
      segments: [...state.segments, segment].sort((a, b) => a.start_time - b.start_time),
    })),

  setSegments: (segments) => set({ segments }),

  setLiveCaption: (liveCaption) => set({ liveCaption }),

  setActiveSpeaker: (activeSpeaker) => set({ activeSpeaker }),

  setLoading: (isLoading) => set({ isLoading }),

  clearTranscript: () =>
    set({ segments: [], liveCaption: '', activeSpeaker: null }),
}));
