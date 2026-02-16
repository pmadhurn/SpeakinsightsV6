import { useCallback, useRef, useState, useEffect } from 'react';
import api from '@/services/api';

interface UseAudioChunkingOptions {
  meetingId: string;
  participantName: string;
  enabled: boolean;
  chunkDuration?: number; // milliseconds, default 20000 (20s)
}

interface ChunkInfo {
  chunksSent: number;
  lastChunkTime: number | null;
  errors: number;
}

export function useAudioChunking({
  meetingId,
  participantName,
  enabled,
  chunkDuration = 20000,
}: UseAudioChunkingOptions) {
  const [isChunking, setIsChunking] = useState(false);
  const [chunkInfo, setChunkInfo] = useState<ChunkInfo>({
    chunksSent: 0,
    lastChunkTime: null,
    errors: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkStartTimeRef = useRef<number>(0);
  const enabledRef = useRef(enabled);
  const meetingIdRef = useRef(meetingId);
  const participantNameRef = useRef(participantName);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);
  useEffect(() => {
    participantNameRef.current = participantName;
  }, [participantName]);

  const sendChunk = useCallback(async (blob: Blob, startOffset: number) => {
    if (blob.size < 100) return; // Skip tiny chunks

    const formData = new FormData();
    formData.append('audio', blob, `chunk-${Date.now()}.webm`);
    formData.append('participant_name', participantNameRef.current);
    formData.append('start_offset', String(startOffset));

    try {
      await api.post(
        `/meetings/${meetingIdRef.current}/transcribe/chunk`,
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
    } catch (err) {
      console.error('[AudioChunking] Failed to send chunk:', err);
      setChunkInfo((prev) => ({
        ...prev,
        errors: prev.errors + 1,
      }));
    }
  }, []);

  const processAndSendChunk = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    const recorder = mediaRecorderRef.current;
    const currentStartOffset = chunkStartTimeRef.current;

    // Stop current recording to flush data
    recorder.stop();

    // Wait for chunks to be collected, then send
    setTimeout(() => {
      if (chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        chunksRef.current = [];
        sendChunk(blob, currentStartOffset);
      }

      // Update start offset for next chunk
      chunkStartTimeRef.current += chunkDuration / 1000;

      // Start new recording if still enabled
      if (enabledRef.current && streamRef.current) {
        try {
          const newRecorder = new MediaRecorder(streamRef.current, {
            mimeType: 'audio/webm;codecs=opus',
          });
          newRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunksRef.current.push(e.data);
            }
          };
          mediaRecorderRef.current = newRecorder;
          newRecorder.start();
        } catch (err) {
          console.error('[AudioChunking] Failed to restart recorder:', err);
        }
      }
    }, 100);
  }, [chunkDuration, sendChunk]);

  const startChunking = useCallback(async () => {
    try {
      // Get audio stream from user's microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];
      chunkStartTimeRef.current = 0;

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsChunking(true);
      setChunkInfo({ chunksSent: 0, lastChunkTime: null, errors: 0 });

      // Set up interval to process chunks every chunkDuration ms
      intervalRef.current = setInterval(() => {
        processAndSendChunk();
      }, chunkDuration);
    } catch (err) {
      console.error('[AudioChunking] Failed to start:', err);
      setIsChunking(false);
    }
  }, [chunkDuration, processAndSendChunk]);

  const stopChunking = useCallback(() => {
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Stop recorder and send final chunk
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setTimeout(() => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
          chunksRef.current = [];
          sendChunk(blob, chunkStartTimeRef.current);
        }
      }, 100);
    }

    // Stop media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
    setIsChunking(false);
  }, [sendChunk]);

  // Auto start/stop based on enabled
  useEffect(() => {
    if (enabled && meetingId) {
      startChunking();
    }
    return () => {
      stopChunking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, meetingId]);

  return {
    isChunking,
    chunksSent: chunkInfo.chunksSent,
    lastChunkTime: chunkInfo.lastChunkTime,
    errors: chunkInfo.errors,
    startChunking,
    stopChunking,
  };
}

export default useAudioChunking;
