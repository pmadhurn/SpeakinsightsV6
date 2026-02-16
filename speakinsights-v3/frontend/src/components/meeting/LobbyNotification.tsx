import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Check, X } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';

interface LobbyEntry {
  id?: string;
  participant_id?: string;
  name: string;
  requested_at?: string;
  timestamp?: string;
}

interface LobbyNotificationProps {
  participants: LobbyEntry[];
  onApprove: (participantId: string) => void;
  onDecline: (participantId: string) => void;
}

export function LobbyNotification({
  participants,
  onApprove,
  onDecline,
}: LobbyNotificationProps) {
  if (participants.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-80">
      <AnimatePresence>
        {participants.map((p) => {
          const pid = p.participant_id || p.id || '';
          return (
          <motion.div
            key={pid}
            initial={{ opacity: 0, y: -20, scale: 0.95, x: 20 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="rounded-2xl p-4 bg-navy-light/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40"
          >
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <Avatar name={p.name} size="md" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-lavender/20 border border-lavender/30 flex items-center justify-center">
                  <UserPlus size={10} className="text-lavender" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">
                  {p.name}
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  wants to join the meeting
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => onApprove(pid)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium bg-cyan/20 text-cyan border border-cyan/30 hover:bg-cyan/30 transition-all"
              >
                <Check size={14} /> Admit
              </button>
              <button
                onClick={() => onDecline(pid)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
              >
                <X size={14} /> Decline
              </button>
            </div>
          </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default LobbyNotification;
