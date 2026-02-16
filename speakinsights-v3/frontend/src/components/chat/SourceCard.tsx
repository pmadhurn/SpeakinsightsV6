import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, User } from 'lucide-react';

interface SourceCardProps {
  segment_id?: string;
  speaker_name: string;
  text: string;
  start_time: number;
  meeting_title?: string;
  meeting_id?: string;
  score: number;
}

export function SourceCard({
  speaker_name,
  text,
  start_time,
  meeting_title,
  meeting_id,
  score,
}: SourceCardProps) {
  const navigate = useNavigate();

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleClick = () => {
    if (meeting_id) {
      navigate(`/meeting/${meeting_id}/review?t=${Math.floor(start_time)}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl px-3 py-2.5 bg-white/[0.04] backdrop-blur-sm border border-white/10 hover:border-lavender/30 transition-all cursor-pointer group"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText size={11} className="text-lavender/70 shrink-0" />
          <span className="text-xs font-medium text-lavender/80 truncate max-w-[160px]">
            {meeting_title || 'Meeting'}
          </span>
        </div>
        <span className="text-[10px] text-cyan/80 bg-cyan/10 px-1.5 py-0.5 rounded-full shrink-0 ml-2">
          {Math.round(score * 100)}%
        </span>
      </div>

      <p className="text-xs text-white/60 line-clamp-2 leading-relaxed mb-1.5">
        {text}
      </p>

      <div className="flex items-center gap-3 text-[10px] text-white/35">
        <span className="flex items-center gap-1">
          <User size={9} />
          <span className="font-medium text-white/45">{speaker_name}</span>
        </span>
        <span className="flex items-center gap-0.5">
          <Clock size={9} />
          {formatTime(start_time)}
        </span>
      </div>
    </motion.div>
  );
}

export default SourceCard;
