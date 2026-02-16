import { useState, useCallback, useEffect, useRef } from 'react';
import { meetings } from '@/services/api';
import { useMeetingStore } from '@/stores/meetingStore';
import { useWebSocket } from './useWebSocket';
import type { Meeting, Participant } from '@/types/meeting';

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

interface UseMeetingOptions {
  meetingId: string;
  participantName?: string;
  isHost?: boolean;
}

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

export function useMeeting({ meetingId, participantName, isHost: initialIsHost }: UseMeetingOptions) {
  const store = useMeetingStore();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isHost, setIsHost] = useState(initialIsHost ?? false);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meetingStartRef = useRef<number | null>(null);

  // ── Meeting events WebSocket ──
  const { sendMessage: sendMeetingWs, isConnected: meetingWsConnected } = useWebSocket(
    meetingId ? `${WS_BASE}/ws/meeting/${meetingId}` : undefined,
    {
      onMessage: (data: unknown) => {
        const msg = data as Record<string, unknown>;
        console.log('[SpeakInsights] Meeting WS message:', msg);

        switch (msg.type) {
          case 'participant_joined': {
            const p = msg.participant as Participant;
            setParticipants((prev) => [...prev.filter((x) => x.id !== p.id), p]);
            store.addParticipant(p);
            break;
          }
          case 'participant_left': {
            const pid = msg.participant_id as string;
            setParticipants((prev) => prev.filter((x) => x.id !== pid));
            store.removeParticipant(pid);
            break;
          }
          case 'meeting_started': {
            setMeeting((prev) =>
              prev ? { ...prev, status: 'active', started_at: msg.started_at as string } : prev
            );
            meetingStartRef.current = Date.now();
            break;
          }
          case 'meeting_ended': {
            setMeeting((prev) =>
              prev ? { ...prev, status: 'processing', ended_at: msg.ended_at as string } : prev
            );
            if (durationTimerRef.current) clearInterval(durationTimerRef.current);
            break;
          }
          case 'recording_started': {
            setIsRecording(true);
            break;
          }
          case 'recording_stopped': {
            setIsRecording(false);
            break;
          }
          case 'screen_share_started': {
            setIsScreenSharing(true);
            break;
          }
          case 'screen_share_stopped': {
            setIsScreenSharing(false);
            break;
          }
          case 'error': {
            setError(msg.message as string);
            break;
          }
        }
      },
      onOpen: () => {
        console.log('[SpeakInsights] Meeting WS connected');
        setConnectionState('connected');
      },
      onClose: () => {
        console.log('[SpeakInsights] Meeting WS disconnected');
        setConnectionState('disconnected');
      },
      autoReconnect: true,
    }
  );

  // ── Fetch meeting data on mount ──
  useEffect(() => {
    if (!meetingId) return;

    setConnectionState('connecting');
    console.log('[SpeakInsights] Fetching meeting data:', meetingId);

    meetings
      .get(meetingId)
      .then((data) => {
        setMeeting(data);
        store.setCurrentMeeting(data);
        setIsHost(data.host_name === participantName || initialIsHost === true);

        // If meeting is already active, compute elapsed duration
        if (data.started_at && data.status === 'active') {
          meetingStartRef.current = new Date(data.started_at).getTime();
        }
      })
      .catch((err) => {
        console.error('[SpeakInsights] Failed to fetch meeting:', err);
        setError('Failed to load meeting data');
      });

    return () => {
      store.setCurrentMeeting(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  // ── Duration timer ──
  useEffect(() => {
    if (meeting?.status === 'active' && meetingStartRef.current) {
      // Immediately set current duration
      setMeetingDuration(Math.floor((Date.now() - meetingStartRef.current) / 1000));

      durationTimerRef.current = setInterval(() => {
        if (meetingStartRef.current) {
          setMeetingDuration(Math.floor((Date.now() - meetingStartRef.current) / 1000));
        }
      }, 1000);
    }

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [meeting?.status]);

  // ── Actions ──
  const startMeeting = useCallback(async () => {
    if (!meetingId) return;
    try {
      console.log('[SpeakInsights] Starting meeting:', meetingId);
      const updated = await meetings.start(meetingId);
      setMeeting((prev) => (prev ? { ...prev, ...updated, status: 'active' } : prev));
      meetingStartRef.current = Date.now();
    } catch (err) {
      console.error('[SpeakInsights] Failed to start meeting:', err);
      setError('Failed to start meeting');
    }
  }, [meetingId]);

  const endMeeting = useCallback(async () => {
    if (!meetingId) return;
    try {
      console.log('[SpeakInsights] Ending meeting:', meetingId);
      const updated = await meetings.end(meetingId);
      setMeeting((prev) => (prev ? { ...prev, ...updated, status: 'processing' } : prev));
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    } catch (err) {
      console.error('[SpeakInsights] Failed to end meeting:', err);
      setError('Failed to end meeting');
    }
  }, [meetingId]);

  const toggleScreenShare = useCallback(async () => {
    // Screen share toggle is handled at the LiveKit component level;
    // this sends a signal via the meeting WebSocket so other participants are notified
    sendMeetingWs({
      type: isScreenSharing ? 'screen_share_stopped' : 'screen_share_started',
      participant_name: participantName,
    });
    setIsScreenSharing((prev) => !prev);
  }, [isScreenSharing, participantName, sendMeetingWs]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, []);

  return {
    meeting,
    participants,
    isHost,
    isRecording,
    isScreenSharing,
    meetingDuration,
    connectionState,
    error,
    meetingWsConnected,
    actions: {
      startMeeting,
      endMeeting,
      toggleScreenShare,
    },
  };
}

export default useMeeting;
