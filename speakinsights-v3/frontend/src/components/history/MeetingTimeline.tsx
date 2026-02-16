import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { getAvatarColor } from '@/utils/colors';
import { formatTimestamp } from '@/utils/formatTime';
import type { TranscriptSegment } from '@/types/transcription';

interface MeetingTimelineProps {
  segments: TranscriptSegment[];
  duration: number;
  onSegmentClick?: (startTime: number) => void;
}

export function MeetingTimeline({
  segments,
  duration,
  onSegmentClick,
}: MeetingTimelineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Get unique speakers with colors
  const speakerColors = useMemo(() => {
    const colors: Record<string, string> = {};
    segments.forEach((seg) => {
      if (!colors[seg.speaker_name]) {
        colors[seg.speaker_name] = getAvatarColor(seg.speaker_name);
      }
    });
    return colors;
  }, [segments]);

  const speakers = Object.keys(speakerColors);

  if (segments.length === 0 || duration <= 0) {
    return null;
  }

  return (
    <div className="rounded-2xl p-4 bg-white/[0.04] backdrop-blur-xl border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <h4 className="text-xs font-medium text-white/60">Speaker Timeline</h4>
        <span className="text-[10px] text-white/25 ml-auto">
          {formatTimestamp(0)} — {formatTimestamp(duration)}
        </span>
      </div>

      {/* Timeline bar */}
      <div className="relative h-8 rounded-lg bg-white/[0.03] border border-white/5 overflow-hidden">
        {segments.map((seg, i) => {
          const left = (seg.start_time / duration) * 100;
          const width = Math.max(((seg.end_time - seg.start_time) / duration) * 100, 0.3);
          const color = speakerColors[seg.speaker_name] || '#888';
          const isHovered = hoveredIndex === i;

          return (
            <motion.div
              key={seg.id || i}
              className="absolute top-0 bottom-0 cursor-pointer transition-opacity"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: color,
                opacity: isHovered ? 1 : 0.5,
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onSegmentClick?.(seg.start_time)}
              whileHover={{ scaleY: 1.15 }}
            >
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                  <div className="rounded-lg px-3 py-2 bg-navy-light/95 backdrop-blur-xl border border-white/10 shadow-lg whitespace-nowrap">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[10px] font-semibold text-white/80">
                        {seg.speaker_name}
                      </span>
                      <span className="text-[9px] text-white/30 font-mono">
                        {formatTimestamp(seg.start_time)} — {formatTimestamp(seg.end_time)}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/50 max-w-[200px] truncate">
                      {seg.text}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2.5">
        {speakers.map((speaker) => (
          <div key={speaker} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: speakerColors[speaker] }}
            />
            <span className="text-[10px] text-white/40">{speaker}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MeetingTimeline;
