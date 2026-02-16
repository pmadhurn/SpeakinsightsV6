import { useState, useCallback } from 'react';

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startRecording = useCallback(async (_meetingId: string) => {
    setError(null);
    setIsRecording(true);
    // Placeholder: would call backend to start recording
  }, []);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    setRecordingId(null);
    // Placeholder: would call backend to stop recording
  }, []);

  return { isRecording, recordingId, error, startRecording, stopRecording };
}

export default useRecording;
