import { useState, useCallback } from 'react';

interface TranscriptSegment {
  speaker_name: string;
  text: string;
  start_time: number;
  sentiment_score?: number;
}

export function useTranscription() {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startTranscription = useCallback(async (_meetingId: string) => {
    setError(null);
    setIsTranscribing(true);
    // Placeholder: would connect to transcription WebSocket
  }, []);

  const stopTranscription = useCallback(() => {
    setIsTranscribing(false);
    // Placeholder: would disconnect from transcription stream
  }, []);

  const addSegment = useCallback((segment: TranscriptSegment) => {
    setSegments((prev) => [...prev, segment]);
  }, []);

  return { segments, isTranscribing, error, startTranscription, stopTranscription, addSegment };
}

export default useTranscription;
