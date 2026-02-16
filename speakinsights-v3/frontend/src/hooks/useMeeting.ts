import { useState, useCallback } from 'react';

interface MeetingState {
  id: string | null;
  title: string;
  status: 'idle' | 'joining' | 'active' | 'ended';
  participantCount: number;
}

export function useMeeting() {
  const [meeting, setMeeting] = useState<MeetingState>({
    id: null,
    title: '',
    status: 'idle',
    participantCount: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const createMeeting = useCallback(async (_title: string) => {
    setMeeting((prev) => ({ ...prev, status: 'joining' }));
    setError(null);
    // Placeholder: would call backend API to create meeting
  }, []);

  const joinMeeting = useCallback(async (_meetingId: string) => {
    setMeeting((prev) => ({ ...prev, status: 'joining' }));
    setError(null);
    // Placeholder: would call backend API to join meeting
  }, []);

  const endMeeting = useCallback(async () => {
    setMeeting((prev) => ({ ...prev, status: 'ended' }));
    // Placeholder: would call backend API to end meeting
  }, []);

  return { meeting, error, createMeeting, joinMeeting, endMeeting };
}

export default useMeeting;
