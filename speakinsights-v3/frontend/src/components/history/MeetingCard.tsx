import { motion } from 'framer-motion';
import { Calendar, Users, Clock, ChevronRight, FileText, Film, Brain, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import { formatDate, formatRelativeTime } from '@/utils/formatTime';
import { getSentimentColor } from '@/utils/colors';
import type { Meeting } from '@/types/meeting';

interface MeetingCardProps {
  meeting: Meeting;
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  const navigate = useNavigate();

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const statusBadge = () => {
    switch (meeting.status) {
      case 'completed':
        return <Badge text="Ended" variant="green" />;
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30">
            <Loader2 size={10} className="animate-spin" />
            Processing
          </span>
        );
      case 'active':
        return <Badge text="Active" variant="cyan" />;
      case 'cancelled':
        return <Badge text="Archived" variant="gray" />;
      default:
        return <Badge text={meeting.status} variant="gray" />;
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.005, y: -2 }}
      whileTap={{ scale: 0.995 }}
      onClick={() => navigate(`/meeting/${meeting.id}/review`)}
      className="group rounded-2xl p-4 bg-white/[0.06] backdrop-blur-xl border border-white/10 
        hover:border-cyan/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.08)] 
        transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-start gap-4">
        {/* LEFT: Date + Duration */}
        <div className="flex-shrink-0 text-center w-16">
          <div className="text-[10px] text-white/30 uppercase tracking-wider">
            {new Date(meeting.created_at).toLocaleDateString('en-US', { month: 'short' })}
          </div>
          <div className="text-2xl font-bold text-white/80 leading-tight">
            {new Date(meeting.created_at).getDate()}
          </div>
          <div className="mt-1.5 px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-white/40">
            {formatDuration(meeting.duration)}
          </div>
        </div>

        {/* CENTER: Title, description, host */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white/90 truncate group-hover:text-cyan transition-colors">
            {meeting.title}
          </h3>
          {meeting.description && (
            <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{meeting.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {formatDate(meeting.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <Users size={11} />
              {meeting.participant_count || 0}
            </span>
            {meeting.host_name && (
              <span className="flex items-center gap-1">
                <Avatar name={meeting.host_name} size="sm" className="!w-4 !h-4 !text-[8px]" />
                {meeting.host_name}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: Status + icons */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {statusBadge()}
          <div className="flex items-center gap-1.5 text-white/20">
            <Film size={13} className="hover:text-white/40" />
            <Brain size={13} className="hover:text-white/40" />
            <FileText size={13} className="hover:text-white/40" />
          </div>
          <ChevronRight
            size={16}
            className="text-white/20 group-hover:text-cyan/60 transition-colors"
          />
        </div>
      </div>
    </motion.div>
  );
}

export default MeetingCard;
