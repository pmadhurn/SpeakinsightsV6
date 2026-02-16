import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAvatarColor } from '@/utils/colors';
import { getSentimentColor } from '@/utils/colors';
import { formatTimestamp } from '@/utils/formatTime';
import type { TranscriptSegment as TSegment } from '@/types/transcription';

interface TranscriptSegmentProps {
  segment: TSegment;
  isActive?: boolean;
  onClick?: () => void;
}

export function TranscriptSegment({
  segment,
  isActive = false,
  onClick,
}: TranscriptSegmentProps) {
  const [expanded, setExpanded] = useState(false);
  const { speaker_name, text, start_time, end_time, sentiment_score, sentiment_label, words } = segment;

  const speakerColor = getAvatarColor(speaker_name);
  const sentColor = sentiment_score != null ? getSentimentColor(sentiment_score) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => setExpanded(!expanded)}
      className={`group relative rounded-lg px-3 py-2 transition-all cursor-pointer ${
        isActive
          ? 'bg-cyan/[0.05] border-l-2 border-cyan shadow-[0_0_12px_rgba(34,211,238,0.08)]'
          : 'border-l-2 border-transparent hover:bg-white/[0.03]'
      }`}
    >
      <div className="flex gap-2.5">
        {/* Avatar */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
          style={{
            backgroundColor: `${speakerColor}20`,
            color: speakerColor,
          }}
        >
          {speaker_name.charAt(0).toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold" style={{ color: speakerColor }}>
              {speaker_name}
            </span>

            {/* Sentiment dot */}
            {sentColor && (
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: sentColor }}
                title={`Sentiment: ${sentiment_label || sentiment_score?.toFixed(2)}`}
              />
            )}

            {/* Timestamp - clickable to jump video */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
              className={`text-[10px] font-mono transition-colors ml-auto flex-shrink-0 px-1.5 py-0.5 rounded ${
                isActive
                  ? 'text-cyan bg-cyan/10'
                  : 'text-white/25 hover:text-cyan hover:bg-cyan/10'
              }`}
            >
              {formatTimestamp(start_time)}
            </button>
          </div>

          <p className="text-xs text-white/70 leading-relaxed">{text}</p>

          {/* Expanded: word-level timestamps */}
          <AnimatePresence>
            {expanded && words && words.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 pt-2 border-t border-white/5 overflow-hidden"
              >
                <div className="flex flex-wrap gap-0.5">
                  {words.map((w, i) => (
                    <span
                      key={i}
                      className="inline-block px-1 py-0.5 rounded text-[10px] text-white/50 bg-white/[0.03] hover:bg-cyan/10 hover:text-cyan transition-colors cursor-default"
                      title={`${formatTimestamp(w.start)} - ${formatTimestamp(w.end)}${w.score ? ` (${(w.score * 100).toFixed(0)}%)` : ''}`}
                    >
                      {w.word}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

export default TranscriptSegment;
