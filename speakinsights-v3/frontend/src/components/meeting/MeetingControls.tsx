import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Users,
  MessageSquare,
  FileText,
  Subtitles,
} from 'lucide-react';
import { useLocalParticipant, useParticipants } from '@livekit/components-react';
import { useUIStore, type SidebarTab } from '@/stores/uiStore';

interface MeetingControlsProps {
  isHost: boolean;
  onEndMeeting: () => void;
  onLeaveMeeting: () => void;
  captionsEnabled: boolean;
  onToggleCaptions: () => void;
  duration: string;
}

export function MeetingControls({
  isHost,
  onEndMeeting,
  onLeaveMeeting,
  captionsEnabled,
  onToggleCaptions,
  duration,
}: MeetingControlsProps) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const { sidebarOpen, sidebarTab, setSidebarTab, toggleSidebar } = useUIStore();

  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const isMuted = !localParticipant.isMicrophoneEnabled;
  const isCameraOff = !localParticipant.isCameraEnabled;

  const toggleMic = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(isMuted);
  }, [localParticipant, isMuted]);

  const toggleCamera = useCallback(async () => {
    await localParticipant.setCameraEnabled(isCameraOff);
  }, [localParticipant, isCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenSharing);
      setIsScreenSharing(!isScreenSharing);
    } catch {
      // User cancelled screen share picker
      setIsScreenSharing(false);
    }
  }, [localParticipant, isScreenSharing]);

  const handleSidebarTab = useCallback(
    (tab: SidebarTab) => {
      if (sidebarOpen && sidebarTab === tab) {
        toggleSidebar();
      } else {
        setSidebarTab(tab);
      }
    },
    [sidebarOpen, sidebarTab, setSidebarTab, toggleSidebar]
  );

  const btnBase =
    'relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 group';

  const Tooltip = ({ text }: { text: string }) => (
    <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-navy-light border border-white/10 text-[10px] text-white/80 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
      {text}
    </span>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-navy-light/90 backdrop-blur-xl border border-white/10"
    >
      {/* Recording indicator */}
      <div className="flex items-center gap-2 mr-4 pr-4 border-r border-white/10">
        <span className="flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
        <span className="text-xs text-red-400 font-medium">REC</span>
        <span className="text-xs text-white/50 font-mono">{duration}</span>
      </div>

      {/* Mic */}
      <button
        onClick={toggleMic}
        className={`${btnBase} ${
          isMuted
            ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
            : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
        }`}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        <Tooltip text={isMuted ? 'Unmute' : 'Mute'} />
      </button>

      {/* Camera */}
      <button
        onClick={toggleCamera}
        className={`${btnBase} ${
          isCameraOff
            ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
            : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
        }`}
        title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
      >
        {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
        <Tooltip text={isCameraOff ? 'Turn on camera' : 'Turn off camera'} />
      </button>

      {/* Screen Share */}
      <button
        onClick={toggleScreenShare}
        className={`${btnBase} ${
          isScreenSharing
            ? 'bg-cyan/20 text-cyan border border-cyan/30 hover:bg-cyan/30'
            : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
        }`}
        title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
      >
        {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
        <Tooltip text={isScreenSharing ? 'Stop sharing' : 'Share screen'} />
      </button>

      {/* Captions */}
      <button
        onClick={onToggleCaptions}
        className={`${btnBase} ${
          captionsEnabled
            ? 'bg-cyan/20 text-cyan border border-cyan/30 hover:bg-cyan/30'
            : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
        }`}
        title={captionsEnabled ? 'Disable captions' : 'Enable captions'}
      >
        <Subtitles size={20} />
        <Tooltip text={captionsEnabled ? 'Disable captions' : 'Enable captions'} />
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-white/10 mx-1" />

      {/* Participants */}
      <button
        onClick={() => handleSidebarTab('participants')}
        className={`${btnBase} ${
          sidebarOpen && sidebarTab === 'participants'
            ? 'bg-cyan/20 text-cyan border border-cyan/30'
            : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
        }`}
        title="Participants"
      >
        <Users size={20} />
        {participants.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-cyan text-navy text-[10px] font-bold flex items-center justify-center">
            {participants.length}
          </span>
        )}
        <Tooltip text="Participants" />
      </button>

      {/* Chat */}
      <button
        onClick={() => handleSidebarTab('chat')}
        className={`${btnBase} ${
          sidebarOpen && sidebarTab === 'chat'
            ? 'bg-cyan/20 text-cyan border border-cyan/30'
            : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
        }`}
        title="Chat"
      >
        <MessageSquare size={20} />
        <Tooltip text="Chat" />
      </button>

      {/* Transcript */}
      <button
        onClick={() => handleSidebarTab('transcript')}
        className={`${btnBase} ${
          sidebarOpen && sidebarTab === 'transcript'
            ? 'bg-cyan/20 text-cyan border border-cyan/30'
            : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
        }`}
        title="Transcript"
      >
        <FileText size={20} />
        <Tooltip text="Transcript" />
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-white/10 mx-1" />

      {/* Leave / End Meeting */}
      {isHost ? (
        <button
          onClick={onEndMeeting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-500/90 text-white hover:bg-red-600 shadow-lg shadow-red-500/25 transition-all text-sm font-medium"
          title="End Meeting"
        >
          <PhoneOff size={18} />
          <span>End Meeting</span>
        </button>
      ) : (
        <button
          onClick={onLeaveMeeting}
          className={`${btnBase} bg-red-500/90 text-white hover:bg-red-600 shadow-lg shadow-red-500/25`}
          title="Leave Meeting"
        >
          <PhoneOff size={20} />
          <Tooltip text="Leave" />
        </button>
      )}
    </motion.div>
  );
}

export default MeetingControls;
