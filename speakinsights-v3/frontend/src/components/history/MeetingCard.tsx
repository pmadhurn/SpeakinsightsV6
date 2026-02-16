import { motion } from 'framer-motion';
import { Calendar, Users, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Meeting {
  id: string;
  title: string;
  status: string;
  created_at: string;
  participant_count: number;
  duration: number;
}

interface MeetingCardProps {
  meeting: Meeting;
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  const navigate = useNavigate();

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    completed: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    ended: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={() => navigate(`/review/${meeting.id}`)}
      className="group rounded-2xl p-4 bg-white/5 backdrop-blur-md border border-white/10 hover:border-cyan-500/30 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">
            {meeting.title}
          </h3>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar size={12} /> {formatDate(meeting.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} /> {meeting.participant_count}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} /> {formatDuration(meeting.duration)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              statusColors[meeting.status] || statusColors.ended
            }`}
          >
            {meeting.status}
          </span>
          <ChevronRight
            size={16}
            className="text-slate-500 group-hover:text-cyan-400 transition-colors"
          />
        </div>
      </div>
    </motion.div>
  );
}

export default MeetingCard;
