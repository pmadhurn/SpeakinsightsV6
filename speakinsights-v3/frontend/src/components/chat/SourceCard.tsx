import { motion } from 'framer-motion';
import { FileText, Clock } from 'lucide-react';

interface SourceCardProps {
  speaker_name: string;
  text: string;
  start_time: number;
  meeting_title: string;
  score: number;
}

export function SourceCard({
  speaker_name,
  text,
  start_time,
  meeting_title,
  score,
}: SourceCardProps) {
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/10 hover:border-purple-500/30 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <FileText size={12} className="text-purple-400" />
          <span className="text-xs font-medium text-purple-300 truncate max-w-[140px]">
            {meeting_title}
          </span>
        </div>
        <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-full">
          {Math.round(score * 100)}%
        </span>
      </div>
      <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
        {text}
      </p>
      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
        <span className="font-medium text-slate-400">{speaker_name}</span>
        <span className="flex items-center gap-0.5">
          <Clock size={10} /> {formatTime(start_time)}
        </span>
      </div>
    </motion.div>
  );
}

export default SourceCard;
