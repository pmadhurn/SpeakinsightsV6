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

  const trackSpeaker = useCallback((name: string) => {
    if (name && !speakerSetRef.current.has(name)) {
      speakerSetRef.current.add(name);
      setSpeakers(Array.from(speakerSetRef.current));
    }
  }, []);

  // ── Declare addSegmentInternal BEFORE useWebSocket to avoid forward-reference ──
  const addSegmentInternal = useCallback(
    (segment: TranscriptSegment) => {
      setSegments((prev) => {
        if (prev.some((s) => s.id === segment.id)) return prev;
        return [...prev, segment].sort((a, b) => a.start_time - b.start_time);
      });
      store.addSegment(segment);
      trackSpeaker(segment.speaker_name);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trackSpeaker]
  );

  // Keep a stable ref so the WS onMessage closure always calls the latest version
  const addSegmentInternalRef = useRef(addSegmentInternal);
  useEffect(() => {
    addSegmentInternalRef.current = addSegmentInternal;
  }, [addSegmentInternal]);

  // ── Transcript WebSocket ──
  const wsUrl = meetingId && enabled ? `${WS_BASE}/ws/transcript/${meetingId}` : undefined;

  const { sendMessage, isConnected } = useWebSocket(wsUrl, {
    onMessage: (data: unknown) => {
      const msg = data as Record<string, unknown>;

      switch (msg.type) {
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
        case 'segment': {
          const segment = msg.segment as TranscriptSegment;
          if (segment) addSegmentInternalRef.current(segment);
          break;
        }
        case 'segments': {
          const batchSegments = msg.segments as TranscriptSegment[];
          if (Array.isArray(batchSegments)) {
            batchSegments.forEach((seg) => addSegmentInternalRef.current(seg));
          }
          break;
        }
        case 'transcription_started':
          setIsTranscribing(true);
          break;
        case 'transcription_stopped':
          setIsTranscribing(false);
          break;
        case 'error':
          setError(msg.message as string);
          break;
      }
    },
    onOpen: () => {
      setIsTranscribing(true);
      setError(null);
    },
    onClose: () => {
      console.log('[SpeakInsights] Transcript WS disconnected');
    },
    autoReconnect: true,
  });

  // ── Public: send a live caption via WebSocket ──
  const addCaption = useCallback(
    (text: string, speaker: string) => {
      sendMessage({ type: 'caption', text, speaker, is_final: true });
    },
    [sendMessage]
  );

  // ── Public: manually add a segment ──
  const addSegment = useCallback(
    (segment: TranscriptSegment) => {
      addSegmentInternal(segment);
    },
    [addSegmentInternal]
  );

  // ── Load existing transcript on mount ──
  useEffect(() => {
    if (!meetingId || !enabled) return;
    transcriptions
      .getTranscript(meetingId)
      .then((existingSegments) => {
        if (existingSegments.length > 0) {
          setSegments(existingSegments.sort((a, b) => a.start_time - b.start_time));
          store.setSegments(existingSegments);
          existingSegments.forEach((seg) => trackSpeaker(seg.speaker_name));
        }
      })
      .catch(() => {
        // Not critical — transcript may not exist yet
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

  return { liveCaption, segments, speakers, isTranscribing, isConnected, error, addCaption, addSegment };
}

export default useTranscription;
