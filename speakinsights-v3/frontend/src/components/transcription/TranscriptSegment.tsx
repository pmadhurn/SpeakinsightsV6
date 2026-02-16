import { motion } from 'framer-motion';

interface Segment {
  speaker_name: string;
  text: string;
  start_time: number;
  sentiment_score?: number;
}

interface TranscriptSegmentProps {
  segment: Segment;
}

export function TranscriptSegment({ segment }: TranscriptSegmentProps) {
  const { speaker_name, text, start_time, sentiment_score } = segment;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const sentimentColor =
    sentiment_score === undefined
      ? 'bg-slate-500/20'
      : sentiment_score >= 0.3
        ? 'bg-cyan-500/20'
        : sentiment_score <= -0.3
          ? 'bg-red-500/20'
          : 'bg-slate-500/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 group hover:bg-white/5 rounded-lg px-3 py-2 transition-colors"
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300 mt-0.5">
        {speaker_name.charAt(0).toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-cyan-400">
            {speaker_name}
          </span>
          <span className="text-[10px] text-slate-500">
            {formatTime(start_time)}
          </span>
          {sentiment_score !== undefined && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${sentimentColor}`}
            >
              {sentiment_score.toFixed(2)}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{text}</p>
      </div>
    </motion.div>
  );
}

export default TranscriptSegment;
