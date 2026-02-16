import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LiveKitRoom,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import {
  Users,
  Clock,
  ChevronRight,
  X,
} from 'lucide-react';

import { VideoGrid } from '@/components/meeting/VideoGrid';
import { MeetingControls } from '@/components/meeting/MeetingControls';
import { CaptionOverlay } from '@/components/meeting/CaptionOverlay';
import { LiveTranscript } from '@/components/meeting/LiveTranscript';
import { ParticipantList } from '@/components/meeting/ParticipantList';
import { ChatPanel } from '@/components/meeting/ChatPanel';
import { LobbyNotification } from '@/components/meeting/LobbyNotification';
import GlassModal from '@/components/ui/GlassModal';
import GlassButton from '@/components/ui/GlassButton';
import { useLiveCaptions } from '@/hooks/useLiveCaptions';
import { useAudioChunking } from '@/hooks/useAudioChunking';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useLobby } from '@/hooks/useLobby';
import { useUIStore } from '@/stores/uiStore';
import { useTranscriptStore } from '@/stores/transcriptStore';
import { useMeetingStore } from '@/stores/meetingStore';
import { meetings as meetingsApi } from '@/services/api';
import { formatDuration } from '@/utils/formatTime';
import { glassToast } from '@/components/ui/Toast';
import type { TranscriptSegment } from '@/types/transcription';

// Re-type lobby participants to work with both useLobby and components
interface LobbyEntry {
  id?: string;
  participant_id?: string;
  name: string;
  requested_at?: string;
  timestamp?: string;
}

interface LocationState {
  token?: string;
  roomId?: string;
  livekitUrl?: string;
  participantName?: string;
  isHost?: boolean;
  meetingTitle?: string;
}

export default function MeetingRoom() {
  const { id: meetingId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as LocationState) || {};

  // Core meeting state
  const [token, setToken] = useState(state.token || '');
  const [livekitUrl, setLivekitUrl] = useState(
    state.livekitUrl || import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880'
  );
  const [isHost, setIsHost] = useState(state.isHost || false);
  const [participantName, setParticipantName] = useState(state.participantName || 'Guest');
  const [meetingTitle, setMeetingTitle] = useState(state.meetingTitle || 'Meeting');
  const [isConnected, setIsConnected] = useState(false);

  // UI state
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Stores
  const { sidebarOpen, sidebarTab, setSidebarOpen } = useUIStore();
  const { addSegment, setLiveCaption, clearTranscript } = useTranscriptStore();
  const { setCurrentMeeting } = useMeetingStore();

  // Timer ref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meetingStartRef = useRef<number>(Date.now());

  // ─── Redirect if no token ───
  useEffect(() => {
    if (!token && meetingId) {
      // Fetch meeting to get the code, then redirect to join page
      meetingsApi.get(meetingId).then((m) => {
        navigate(`/join/${m.code}`, { replace: true });
      }).catch(() => {
        navigate('/', { replace: true });
      });
    }
  }, [token, meetingId, navigate]);

  // ─── Elapsed time timer ───
  useEffect(() => {
    if (isConnected) {
      meetingStartRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - meetingStartRef.current) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isConnected]);

  // ─── Cleanup on unmount ───
  useEffect(() => {
    return () => {
      clearTranscript();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [clearTranscript]);

  // ─── Lobby WebSocket (Host only) ───
  const {
    waitingList: rawLobbyParticipants,
    approve: approveLobby,
    decline: declineLobby,
  } = useLobby({
    meetingId: meetingId || '',
    role: 'host',
    autoConnect: isHost && !!meetingId,
  });

  // Map lobby participants to consistent shape
  const lobbyParticipants: LobbyEntry[] = rawLobbyParticipants.map((p) => ({
    id: p.id,
    participant_id: p.id,
    name: p.name,
    timestamp: p.timestamp,
  }));

  // ─── Transcript WebSocket ───
  const handleTranscriptMessage = useCallback(
    (data: unknown) => {
      const msg = data as Record<string, unknown>;
      if (msg.type === 'segment' || msg.type === 'transcript') {
        const segment = (msg.segment || msg) as TranscriptSegment;
        if (segment.speaker_name && segment.text) {
          addSegment(segment);
        }
      } else if (msg.type === 'caption') {
        setLiveCaption((msg.text as string) || '');
      }
    },
    [addSegment, setLiveCaption]
  );

  const { connect: connectTranscriptWs } = useWebSocket(undefined, {
    onMessage: handleTranscriptMessage,
    autoReconnect: true,
  });

  // ─── Meeting events WebSocket ───
  const handleMeetingEvent = useCallback(
    (data: unknown) => {
      const msg = data as Record<string, unknown>;
      if (msg.type === 'meeting_ended') {
        glassToast.info('Meeting has ended');
        navigate(`/meeting/${meetingId}/review`, { replace: true });
      }
    },
    [meetingId, navigate]
  );

  const { connect: connectMeetingWs } = useWebSocket(undefined, {
    onMessage: handleMeetingEvent,
    autoReconnect: true,
  });

  // ─── Connect WebSockets once LiveKit connects ───
  useEffect(() => {
    if (isConnected && meetingId) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      connectTranscriptWs(`${protocol}//${host}/ws/transcript/${meetingId}`);
      connectMeetingWs(`${protocol}//${host}/ws/meeting/${meetingId}`);
    }
  }, [isConnected, meetingId, connectTranscriptWs, connectMeetingWs]);

  // ─── Live Captions ───
  const {
    currentCaption,
    captions,
    isListening: isCaptionListening,
  } = useLiveCaptions({
    enabled: captionsEnabled,
    participantName,
    onCaption: (text, speaker) => {
      // Could send captions via WebSocket to share with others
      // For now, captions are local-only (per spec: Browser Speech API is client-side)
    },
  });

  // ─── Audio Chunking for WhisperX ───
  useAudioChunking({
    meetingId: meetingId || '',
    participantName,
    enabled: isConnected,
  });

  // ─── Fetch meeting details ───
  useEffect(() => {
    if (meetingId) {
      meetingsApi
        .get(meetingId)
        .then((meeting) => {
          setMeetingTitle(meeting.title);
          setCurrentMeeting(meeting);
        })
        .catch(() => {
          // Meeting details not critical, continue
        });
    }
  }, [meetingId, setCurrentMeeting]);

  // ─── LiveKit callbacks ───
  const handleConnected = useCallback(async () => {
    setIsConnected(true);
    glassToast.success('Connected to meeting');

    // If host, notify backend to start the meeting
    if (isHost && meetingId) {
      try {
        await meetingsApi.start(meetingId);
      } catch {
        // Meeting may already be started
      }
    }
  }, [isHost, meetingId]);

  const handleDisconnected = useCallback(() => {
    setIsConnected(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // ─── End / Leave Meeting ───
  const handleEndMeeting = useCallback(async () => {
    setShowEndModal(false);
    if (!meetingId) return;

    try {
      await meetingsApi.end(meetingId);
      glassToast.success('Meeting ended — processing will begin shortly');
      navigate(`/meeting/${meetingId}/review`, { replace: true });
    } catch {
      glassToast.error('Failed to end meeting');
    }
  }, [meetingId, navigate]);

  const handleLeaveMeeting = useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  const toggleCaptions = useCallback(() => {
    setCaptionsEnabled((prev) => !prev);
  }, []);

  // ─── Don't render if no token ───
  if (!token) {
    return (
      <div className="h-screen flex items-center justify-center bg-navy">
        <div className="text-center">
          <p className="text-white/60 text-sm">Redirecting to join page...</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      audio={true}
      video={true}
      connectOptions={{ autoSubscribe: true }}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      className="h-screen flex flex-col bg-navy overflow-hidden"
      style={{ '--lk-theme-color': '#22D3EE' } as React.CSSProperties}
    >
      {/* Hidden: renders all remote audio tracks */}
      <RoomAudioRenderer />

      {/* ──── Top Bar ──── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-2 bg-navy-light/60 backdrop-blur-xl border-b border-white/5 z-10"
      >
        {/* Meeting title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-white/90 truncate">
            {meetingTitle}
          </h1>
          {isHost && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
              HOST
            </span>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3">
          {/* Recording */}
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-[10px] text-red-400 font-medium">REC</span>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-1 text-white/40">
            <Clock size={12} />
            <span className="text-xs font-mono">{formatDuration(elapsedSeconds)}</span>
          </div>

          {/* Participant count */}
          <div className="flex items-center gap-1 text-white/40">
            <Users size={12} />
          </div>

          {/* Connection status dot */}
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400' : 'bg-red-400'
            }`}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
        </div>
      </motion.div>

      {/* ──── Main Content Area ──── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Grid */}
        <div
          className={`flex-1 min-w-0 transition-all duration-300 ${
            sidebarOpen ? 'mr-0' : ''
          }`}
        >
          <VideoGrid />

          {/* Caption overlay */}
          {captionsEnabled && (currentCaption || captions.length > 0) && (
            <CaptionOverlay
              currentCaption={
                currentCaption
                  ? { text: currentCaption, speaker: participantName }
                  : null
              }
              recentCaptions={captions.slice(-3).map((c) => ({
                id: c.id,
                text: c.text,
                speaker: c.speaker,
                timestamp: c.timestamp,
              }))}
              visible={captionsEnabled}
            />
          )}
        </div>

        {/* ──── Right Sidebar ──── */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="h-full border-l border-white/5 bg-navy-light/40 backdrop-blur-xl overflow-hidden flex flex-col"
            >
              {/* Sidebar header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
                <div className="flex gap-1">
                  {(['participants', 'chat', 'transcript'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => useUIStore.getState().setSidebarTab(tab)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                        sidebarTab === tab
                          ? 'bg-cyan/15 text-cyan'
                          : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Sidebar content */}
              <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                  {sidebarTab === 'participants' && (
                    <motion.div
                      key="participants"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full"
                    >
                      <ParticipantList
                        isHost={isHost}
                        lobbyParticipants={lobbyParticipants}
                        onApproveLobby={approveLobby}
                        onDeclineLobby={declineLobby}
                        hostIdentity={isHost ? participantName : undefined}
                      />
                    </motion.div>
                  )}
                  {sidebarTab === 'chat' && (
                    <motion.div
                      key="chat"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full"
                    >
                      <ChatPanel />
                    </motion.div>
                  )}
                  {sidebarTab === 'transcript' && (
                    <motion.div
                      key="transcript"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full"
                    >
                      <LiveTranscript
                        captions={captions}
                        currentCaption={currentCaption}
                        participantName={participantName}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ──── Bottom Controls ──── */}
      <div className="p-3 flex justify-center z-10">
        <MeetingControls
          isHost={isHost}
          onEndMeeting={() => setShowEndModal(true)}
          onLeaveMeeting={handleLeaveMeeting}
          captionsEnabled={captionsEnabled}
          onToggleCaptions={toggleCaptions}
          duration={formatDuration(elapsedSeconds)}
        />
      </div>

      {/* ──── Lobby Notifications (Host only) ──── */}
      {isHost && (
        <LobbyNotification
          participants={lobbyParticipants}
          onApprove={approveLobby}
          onDecline={declineLobby}
        />
      )}

      {/* ──── End Meeting Modal ──── */}
      <GlassModal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        title="End Meeting"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Are you sure you want to end this meeting for all participants?
            Post-processing (transcription, summary, tasks) will begin automatically.
          </p>
          <div className="flex gap-3">
            <GlassButton
              variant="ghost"
              size="md"
              onClick={() => setShowEndModal(false)}
              fullWidth
            >
              Cancel
            </GlassButton>
            <GlassButton
              variant="danger"
              size="md"
              onClick={handleEndMeeting}
              fullWidth
            >
              End Meeting
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </LiveKitRoom>
  );
}
