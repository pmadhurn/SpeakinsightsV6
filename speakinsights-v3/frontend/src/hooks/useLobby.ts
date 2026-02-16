import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';

// ─── Types ───

interface LobbyParticipant {
  id: string;
  name: string;
  timestamp?: string;
}

type ParticipantLobbyStatus = 'idle' | 'waiting' | 'approved' | 'declined' | 'error';

interface ParticipantState {
  status: ParticipantLobbyStatus;
  position?: number;
  token?: string;
  roomId?: string;
  livekitUrl?: string;
  errorMessage?: string;
}

interface HostState {
  waitingList: LobbyParticipant[];
}

interface UseLobbyOptions {
  meetingId: string;
  participantId?: string;
  role: 'host' | 'participant';
  /** If true, connects immediately. Otherwise call connect() manually. */
  autoConnect?: boolean;
}

export function useLobby({ meetingId, participantId, role, autoConnect = false }: UseLobbyOptions) {
  // ─── Participant state ───
  const [participantState, setParticipantState] = useState<ParticipantState>({
    status: 'idle',
  });

  // ─── Host state ───
  const [hostState, setHostState] = useState<HostState>({
    waitingList: [],
  });

  const connectedRef = useRef(false);

  // Build WebSocket URL
  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const base = `${protocol}//${host}/ws/lobby/${meetingId}`;
    if (role === 'host') {
      return `${base}?role=host`;
    }
    return `${base}?role=participant&participant_id=${participantId}`;
  }, [meetingId, participantId, role]);

  // ─── Message handler ───
  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as Record<string, unknown>;
      const type = msg?.type as string;

      if (role === 'participant') {
        switch (type) {
          case 'waiting':
            setParticipantState((s) => ({
              ...s,
              status: 'waiting',
              position: msg.position as number | undefined,
            }));
            break;
          case 'approved':
            setParticipantState({
              status: 'approved',
              token: msg.token as string,
              roomId: msg.room_id as string,
              livekitUrl: msg.livekit_url as string,
            });
            break;
          case 'declined':
            setParticipantState({
              status: 'declined',
              errorMessage: (msg.reason as string) || 'Your request was declined.',
            });
            break;
          case 'error':
            setParticipantState((s) => ({
              ...s,
              status: 'error',
              errorMessage: (msg.message as string) || 'Something went wrong.',
            }));
            break;
        }
      }

      if (role === 'host') {
        switch (type) {
          case 'waiting_list':
            setHostState({
              waitingList: (msg.participants as LobbyParticipant[]) || [],
            });
            break;
          case 'join_request': {
            const participant = msg.participant as LobbyParticipant;
            if (participant) {
              setHostState((s) => ({
                waitingList: [
                  ...s.waitingList.filter((p) => p.id !== participant.id),
                  participant,
                ],
              }));
            }
            break;
          }
          case 'participant_left': {
            const pid = msg.participant_id as string;
            if (pid) {
              setHostState((s) => ({
                waitingList: s.waitingList.filter((p) => p.id !== pid),
              }));
            }
            break;
          }
        }
      }
    },
    [role]
  );

  const { sendMessage, isConnected, connect: wsConnect, disconnect } = useWebSocket(
    undefined,
    {
      onMessage: handleMessage,
      onOpen: () => {
        connectedRef.current = true;
        if (role === 'participant') {
          setParticipantState((s) => ({
            ...s,
            status: s.status === 'idle' ? 'waiting' : s.status,
          }));
        }
      },
      onClose: () => {
        connectedRef.current = false;
      },
      autoReconnect: true,
    }
  );

  // ─── Connect ───
  const connect = useCallback(() => {
    const url = getWsUrl();
    wsConnect(url);
  }, [getWsUrl, wsConnect]);

  // Auto-connect if requested
  useEffect(() => {
    if (autoConnect && meetingId && (role === 'host' || participantId)) {
      connect();
    }
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, meetingId, participantId, role]);

  // ─── Host actions ───
  const approve = useCallback(
    (pid: string) => {
      sendMessage({ type: 'approve', participant_id: pid });
      // Optimistically remove from waiting list
      setHostState((s) => ({
        waitingList: s.waitingList.filter((p) => p.id !== pid),
      }));
    },
    [sendMessage]
  );

  const decline = useCallback(
    (pid: string) => {
      sendMessage({ type: 'decline', participant_id: pid });
      // Optimistically remove from waiting list
      setHostState((s) => ({
        waitingList: s.waitingList.filter((p) => p.id !== pid),
      }));
    },
    [sendMessage]
  );

  return {
    // Connection
    isConnected,
    connect,
    disconnect,

    // Participant returns
    status: participantState.status,
    position: participantState.position,
    token: participantState.token,
    roomId: participantState.roomId,
    livekitUrl: participantState.livekitUrl,
    errorMessage: participantState.errorMessage,

    // Host returns
    waitingList: hostState.waitingList,
    approve,
    decline,
  };
}

export default useLobby;
