import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { useTranscriptStore } from '@/stores/transcriptStore';
import { transcriptions } from '@/services/api';
import type { TranscriptSegment } from '@/types/transcription';

interface UseTranscriptionOptions {
  meetingId: string;
  participantName?: string;
  enabled?: boolean;
}

interface LiveCaption {
  speaker: string;
  text: string;
  timestamp: number;
}

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

/**
 * Hook connecting to /ws/transcript/{meetingId}.
 * Manages two data streams:
 * 1. Live captions from browser Speech API (relayed via WebSocket)
 * 2. Accurate WhisperX segments (delayed ~20s)
 */
export function useTranscription({
  meetingId,
  participantName,
  enabled = true,
}: UseTranscriptionOptions) {
  const store = useTranscriptStore();

  const [liveCaption, setLiveCaption] = useState<LiveCaption | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speakerSetRef = useRef<Set<string>>(new Set());

  // Track unique speakers
  const trackSpeaker = useCallback((name: string) => {
    if (name && !speakerSetRef.current.has(name)) {
      speakerSetRef.current.add(name);
      setSpeakers(Array.from(speakerSetRef.current));
    }
  }, []);

  // ── Transcript WebSocket ──
  const wsUrl = meetingId && enabled ? `${WS_BASE}/ws/transcript/${meetingId}` : undefined;

  const { sendMessage, isConnected } = useWebSocket(wsUrl, {
    onMessage: (data: unknown) => {
      const msg = data as Record<string, unknown>;
      console.log('[SpeakInsights] Transcript WS message:', msg.type);

      switch (msg.type) {
        // Live caption relayed from another participant
        case 'caption': {
          const caption: LiveCaption = {
            speaker: msg.speaker as string,
            text: msg.text as string,
            timestamp: Date.now(),
          };
          setLiveCaption(caption);
          store.setLiveCaption(msg.text as string);
          store.setActiveSpeaker(msg.speaker as string);
          trackSpeaker(msg.speaker as string);
          break;
        }

        // Accurate WhisperX segment received from backend
        case 'segment': {
          const segment = msg.segment as TranscriptSegment;
          if (segment) {
            addSegmentInternal(segment);
            console.log(
              '[SpeakInsights] New transcript segment:',
              segment.speaker_name,
              segment.text.substring(0, 50)
            );
          }
          break;
        }

        // Batch of segments (e.g. on reconnect or initial load)
        case 'segments': {
          const batchSegments = msg.segments as TranscriptSegment[];
          if (Array.isArray(batchSegments)) {
            batchSegments.forEach((seg) => addSegmentInternal(seg));
          }
          break;
        }

        // Transcription started indicator
        case 'transcription_started': {
          setIsTranscribing(true);
          break;
        }

        // Transcription stopped
        case 'transcription_stopped': {
          setIsTranscribing(false);
          break;
        }

        case 'error': {
          setError(msg.message as string);
          break;
        }
      }
    },
    onOpen: () => {
      console.log('[SpeakInsights] Transcript WS connected');
      setIsTranscribing(true);
      setError(null);
    },
    onClose: () => {
      console.log('[SpeakInsights] Transcript WS disconnected');
    },
    autoReconnect: true,
  });

  // ── Internal: add segment to local state and store ──
  const addSegmentInternal = useCallback(
    (segment: TranscriptSegment) => {
      setSegments((prev) => {
        // Avoid duplicates by ID
        if (prev.some((s) => s.id === segment.id)) return prev;
        const updated = [...prev, segment].sort((a, b) => a.start_time - b.start_time);
        return updated;
      });
      store.addSegment(segment);
      trackSpeaker(segment.speaker_name);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trackSpeaker]
  );

  // ── Public: send a live caption to all participants via WebSocket ──
  const addCaption = useCallback(
    (text: string, speaker: string) => {
      sendMessage({
        type: 'caption',
        text,
        speaker,
        is_final: true,
      });
    },
    [sendMessage]
  );

  // ── Public: manually add a segment (for local processing) ──
  const addSegment = useCallback(
    (segment: TranscriptSegment) => {
      addSegmentInternal(segment);
    },
    [addSegmentInternal]
  );

  // ── Load existing transcript on mount ──
  useEffect(() => {
    if (!meetingId || !enabled) return;

    console.log('[SpeakInsights] Loading existing transcript for meeting:', meetingId);
    transcriptions
      .getTranscript(meetingId)
      .then((existingSegments) => {
        if (existingSegments.length > 0) {
          setSegments(existingSegments.sort((a, b) => a.start_time - b.start_time));
          store.setSegments(existingSegments);
          existingSegments.forEach((seg) => trackSpeaker(seg.speaker_name));
          console.log('[SpeakInsights] Loaded', existingSegments.length, 'existing segments');
        }
      })
      .catch((err) => {
        // Not critical — transcript may not exist yet
        console.log('[SpeakInsights] No existing transcript:', err.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, enabled]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      store.clearTranscript();
      speakerSetRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    liveCaption,
    segments,
    speakers,
    isTranscribing,
    isConnected,
    error,
    addCaption,
    addSegment,
  };
}

export default useTranscription;
