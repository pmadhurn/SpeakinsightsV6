import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

interface UseRecordingOptions {
  meetingId: string;
  /** If provided, connects to meeting WS to listen for recording events */
  wsUrl?: string;
}

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

/**
 * Hook for tracking recording state.
 * Recording is auto-started by the backend when the meeting begins.
 * This hook listens for recording_started / recording_stopped events
 * on the meeting WebSocket and provides a live recording duration counter.
 */
export function useRecording({ meetingId, wsUrl }: UseRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recordingStartRef = useRef<number | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Meeting WebSocket for recording events ──
  const effectiveUrl = wsUrl || (meetingId ? `${WS_BASE}/ws/meeting/${meetingId}` : undefined);

  const { isConnected } = useWebSocket(effectiveUrl, {
    onMessage: (data: unknown) => {
      const msg = data as Record<string, unknown>;

      switch (msg.type) {
        case 'recording_started': {
          console.log('[SpeakInsights] Recording started');
          setIsRecording(true);
          setRecordingId((msg.recording_id as string) || null);
          recordingStartRef.current = Date.now();
          setRecordingDuration(0);
          setError(null);
          break;
        }
        case 'recording_stopped': {
          console.log('[SpeakInsights] Recording stopped');
          setIsRecording(false);
          recordingStartRef.current = null;
          break;
        }
        case 'recording_error': {
          console.error('[SpeakInsights] Recording error:', msg.message);
          setError(msg.message as string);
          break;
        }
      }
    },
    autoReconnect: true,
  });

  // ── Duration timer ──
  useEffect(() => {
    if (isRecording && recordingStartRef.current) {
      durationTimerRef.current = setInterval(() => {
        if (recordingStartRef.current) {
          setRecordingDuration(Math.floor((Date.now() - recordingStartRef.current) / 1000));
        }
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [isRecording]);

  // Format duration as HH:MM:SS
  const formatDuration = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  return {
    isRecording,
    recordingDuration,
    recordingDurationFormatted: formatDuration(recordingDuration),
    recordingId,
    isConnected,
    error,
  };
}

export default useRecording;
