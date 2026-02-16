import { useCallback, useRef, useState, useEffect } from 'react';
import api from '@/services/api';

interface UseAudioChunkingOptions {
  meetingId: string;
  participantName: string;
  enabled: boolean;
  chunkDurationSeconds?: number; // default 20
}

interface ChunkInfo {
  chunksSent: number;
  lastChunkTime: number | null;
  errors: number;
}

/**
 * Capture local participant's audio and send 20-second chunks
 * to backend for WhisperX processing.
 *
 * Uses MediaRecorder API on the user's microphone stream.
 * Every chunkDurationSeconds (default 20):
 *   - Stop the current MediaRecorder (triggers ondataavailable)
 *   - Collect the blob
 *   - Calculate timestamp_offset = (chunk_number * chunk_duration_seconds)
 *   - POST FormData to /api/meetings/{meetingId}/transcribe/chunk
 *   - Start a new MediaRecorder for the next chunk
 *
 * Handles: retry on failure (once), background tab pausing,
 * participant reconnection, and proper cleanup.
 */
export function useAudioChunking({
  meetingId,
  participantName,
  enabled,
  chunkDurationSeconds = 20,
}: UseAudioChunkingOptions) {
  const chunkDuration = chunkDurationSeconds * 1000;

  const [isChunking, setIsChunking] = useState(false);
  const [chunkInfo, setChunkInfo] = useState<ChunkInfo>({
    chunksSent: 0,
    lastChunkTime: null,
    errors: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkNumberRef = useRef<number>(0);
  const enabledRef = useRef(enabled);
  const meetingIdRef = useRef(meetingId);
  const participantNameRef = useRef(participantName);
  const isChunkingRef = useRef(false);

  // Keep refs current
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);
  useEffect(() => {
    participantNameRef.current = participantName;
  }, [participantName]);

  // ── Send a chunk to the backend with retry ──
  const sendChunk = useCallback(
    async (blob: Blob, timestampOffset: number, retryCount = 0) => {
      if (blob.size < 100) {
        console.log('[SpeakInsights] Skipping tiny audio chunk (<100 bytes)');
        return;
      }

      const formData = new FormData();
      formData.append('audio', blob, `chunk-${Date.now()}.webm`);
      formData.append('participant_name', participantNameRef.current);
      formData.append('timestamp_offset', String(timestampOffset));
      formData.append('meeting_id', meetingIdRef.current);

      try {
        console.log(
          `[SpeakInsights] Sending audio chunk #${chunkNumberRef.current}`,
          `(${(blob.size / 1024).toFixed(1)}KB, offset=${timestampOffset}s)`
        );

        await api.post(
          `/transcriptions/${meetingIdRef.current}/chunk`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 30000,
          }
        );

        setChunkInfo((prev) => ({
          ...prev,
          chunksSent: prev.chunksSent + 1,
          lastChunkTime: Date.now(),
        }));
        setError(null);
        console.log(`[SpeakInsights] Chunk #${chunkNumberRef.current} sent successfully`);
      } catch (err) {
        console.error('[SpeakInsights] Failed to send audio chunk:', err);

        // Retry once
        if (retryCount < 1) {
          console.log('[SpeakInsights] Retrying chunk send...');
          setTimeout(() => {
            sendChunk(blob, timestampOffset, retryCount + 1);
          }, 2000);
          return;
        }

        // After retry failure, skip the chunk (don't accumulate)
        console.warn('[SpeakInsights] Chunk send failed after retry, skipping');
        setChunkInfo((prev) => ({
          ...prev,
          errors: prev.errors + 1,
        }));
        setError('Failed to send audio chunk');
      }
    },
    []
  );

  // ── Process current recording and send chunk ──
  const processAndSendChunk = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      console.log('[SpeakInsights] Recorder inactive, skipping chunk processing');
      return;
    }

    const currentChunkNumber = chunkNumberRef.current;
    const timestampOffset = currentChunkNumber * chunkDurationSeconds;

    // Stop current recording to flush data
    const recorder = mediaRecorderRef.current;
    recorder.stop();

    // Wait for ondataavailable to fire, then send
    setTimeout(() => {
      if (chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        chunksRef.current = [];
        sendChunk(blob, timestampOffset);
      }

      // Increment chunk counter
      chunkNumberRef.current += 1;

      // Start new recording if still enabled
      if (enabledRef.current && streamRef.current && isChunkingRef.current) {
        try {
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/ogg;codecs=opus';

          const newRecorder = new MediaRecorder(streamRef.current, { mimeType });
          newRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunksRef.current.push(e.data);
            }
          };
          mediaRecorderRef.current = newRecorder;
          newRecorder.start();
          console.log(`[SpeakInsights] Started recording chunk #${chunkNumberRef.current}`);
        } catch (err) {
          console.error('[SpeakInsights] Failed to restart recorder:', err);
          setError('Failed to restart audio recorder');
        }
      }
    }, 150);
  }, [chunkDurationSeconds, sendChunk]);

  // ── Start chunking ──
  const startChunking = useCallback(async () => {
    if (isChunkingRef.current) {
      console.log('[SpeakInsights] Already chunking, ignoring start');
      return;
    }

    try {
      console.log('[SpeakInsights] Starting audio chunking...');

      // Get audio stream from user's microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];
      chunkNumberRef.current = 0;

      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : 'audio/webm';

      console.log('[SpeakInsights] Using audio format:', mimeType);

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onerror = (e) => {
        console.error('[SpeakInsights] MediaRecorder error:', e);
        setError('Audio recording error');
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      isChunkingRef.current = true;
      setIsChunking(true);
      setChunkInfo({ chunksSent: 0, lastChunkTime: null, errors: 0 });
      setError(null);

      console.log(
        `[SpeakInsights] Audio chunking started (${chunkDurationSeconds}s intervals)`
      );

      // Set up interval to process chunks
      intervalRef.current = setInterval(() => {
        processAndSendChunk();
      }, chunkDuration);
    } catch (err) {
      console.error('[SpeakInsights] Failed to start audio chunking:', err);
      setError('Failed to access microphone');
      setIsChunking(false);
      isChunkingRef.current = false;
    }
  }, [chunkDuration, chunkDurationSeconds, processAndSendChunk]);

  // ── Stop chunking ──
  const stopChunking = useCallback(() => {
    console.log('[SpeakInsights] Stopping audio chunking...');

    isChunkingRef.current = false;

    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Stop recorder and send final chunk
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const finalChunkNumber = chunkNumberRef.current;
      const timestampOffset = finalChunkNumber * chunkDurationSeconds;
      mediaRecorderRef.current.stop();

      setTimeout(() => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
          chunksRef.current = [];
          console.log('[SpeakInsights] Sending final audio chunk');
          sendChunk(blob, timestampOffset);
        }
      }, 150);
    }

    // Stop media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log('[SpeakInsights] Audio track stopped:', track.label);
      });
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
    setIsChunking(false);
    console.log('[SpeakInsights] Audio chunking stopped');
  }, [chunkDurationSeconds, sendChunk]);

  // ── Handle page visibility changes (some browsers pause MediaRecorder) ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && isChunkingRef.current) {
        console.log('[SpeakInsights] Tab hidden — MediaRecorder may pause');
      } else if (!document.hidden && isChunkingRef.current) {
        console.log('[SpeakInsights] Tab visible — checking recorder state');
        // If recorder got paused/inactive while hidden, restart it
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === 'inactive' &&
          streamRef.current
        ) {
          console.log('[SpeakInsights] Restarting recorder after tab became visible');
          try {
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
              ? 'audio/webm;codecs=opus'
              : 'audio/webm';
            const newRecorder = new MediaRecorder(streamRef.current, { mimeType });
            newRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            mediaRecorderRef.current = newRecorder;
            newRecorder.start();
          } catch {
            console.warn('[SpeakInsights] Could not restart recorder after visibility change');
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ── Auto start/stop based on enabled ──
  useEffect(() => {
    if (enabled && meetingId && !isChunkingRef.current) {
      startChunking();
    }
    return () => {
      if (isChunkingRef.current) {
        stopChunking();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, meetingId]);

  return {
    isChunking,
    chunksSent: chunkInfo.chunksSent,
    lastChunkTime: chunkInfo.lastChunkTime,
    errors: chunkInfo.errors,
    error,
    startChunking,
    stopChunking,
  };
}

export default useAudioChunking;
