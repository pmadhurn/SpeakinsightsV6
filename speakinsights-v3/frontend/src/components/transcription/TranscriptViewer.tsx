import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ScrollText } from 'lucide-react';
import { TranscriptSegment } from './TranscriptSegment';

interface Segment {
  speaker_name: string;
  text: string;
  start_time: number;
  sentiment_score?: number;
}

interface TranscriptViewerProps {
  segments: Segment[];
}

export function TranscriptViewer({ segments }: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [segments]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full rounded-2xl bg-white/5 backdrop-blur-md border border-white/10"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <ScrollText size={16} className="text-cyan-400" />
        <h3 className="text-sm font-medium text-white">Transcript</h3>
        <span className="ml-auto text-[10px] text-slate-500">
          {segments.length} segments
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0"
      >
        {segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <ScrollText size={32} className="mb-2 opacity-40" />
            <p className="text-xs">No transcript available</p>
          </div>
        ) : (
          segments.map((seg, i) => (
            <TranscriptSegment key={i} segment={seg} />
          ))
        )}
      </div>
    </motion.div>
  );
}

export default TranscriptViewer;
