import { motion } from 'framer-motion';
import { Users, Mic, MicOff, Video, VideoOff, Crown, Check, X, Clock } from 'lucide-react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';

interface LobbyEntry {
  id?: string;
  participant_id?: string;
  name: string;
  requested_at?: string;
  timestamp?: string;
}

interface ParticipantListProps {
  isHost: boolean;
  lobbyParticipants?: LobbyEntry[];
  onApproveLobby?: (participantId: string) => void;
  onDeclineLobby?: (participantId: string) => void;
  hostIdentity?: string;
}

export function ParticipantList({
  isHost,
  lobbyParticipants = [],
  onApproveLobby,
  onDeclineLobby,
  hostIdentity,
}: ParticipantListProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <Users size={16} className="text-cyan" />
        <h3 className="text-sm font-medium text-white/90">Participants</h3>
        <span className="ml-auto text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
          {participants.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Lobby section (host only) */}
        {isHost && lobbyParticipants.length > 0 && (
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock size={12} className="text-amber-400" />
              <h4 className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">
                Waiting in Lobby ({lobbyParticipants.length})
              </h4>
            </div>
            <div className="space-y-1.5">
              {lobbyParticipants.map((lp) => {
                const lpId = lp.participant_id || lp.id || '';
                return (
                <motion.div
                  key={lpId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10"
                >
                  <Avatar name={lp.name} size="sm" />
                  <span className="text-xs text-white/80 flex-1 truncate">{lp.name}</span>
                  <button
                    onClick={() => onApproveLobby?.(lpId)}
                    className="p-1.5 rounded-md bg-cyan/20 text-cyan hover:bg-cyan/30 transition-colors"
                    title="Admit"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={() => onDeclineLobby?.(lpId)}
                    className="p-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Decline"
                  >
                    <X size={12} />
                  </button>
                </motion.div>
                );
              })}
            </div>
            <div className="border-b border-white/5 mt-3" />
          </div>
        )}

        {/* In-meeting participants */}
        <div className="p-2 space-y-0.5">
          {participants.map((p, i) => {
            const isLocal = p.identity === localParticipant.identity;
            const isParticipantHost = p.identity === hostIdentity;
            const name = p.name || p.identity;

            // Check track states
            const isMicMuted = !p.isMicrophoneEnabled;
            const isCameraOff = !p.isCameraEnabled;

            return (
              <motion.div
                key={p.identity}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                  p.isSpeaking ? 'bg-cyan/5 border border-cyan/10' : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="relative">
                  <Avatar name={name} size="sm" />
                  {p.isSpeaking && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan border border-navy" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-white/90 truncate">
                      {name}{isLocal ? ' (You)' : ''}
                    </p>
                    {isParticipantHost && (
                      <Crown size={10} className="text-amber-400 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {isParticipantHost ? (
                      <Badge text="Host" variant="yellow" className="text-[9px] px-1.5 py-0" />
                    ) : (
                      <Badge text="Participant" variant="gray" className="text-[9px] px-1.5 py-0" />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isCameraOff && (
                    <VideoOff size={13} className="text-red-400/60" />
                  )}
                  {isMicMuted ? (
                    <MicOff size={13} className="text-red-400/60" />
                  ) : (
                    <Mic size={13} className={p.isSpeaking ? 'text-cyan' : 'text-white/30'} />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ParticipantList;
