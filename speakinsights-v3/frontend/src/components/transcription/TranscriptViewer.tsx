import { useRef, useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Search, Filter } from 'lucide-react';
import { TranscriptSegment } from './TranscriptSegment';
import type { TranscriptSegment as TSegment } from '@/types/transcription';

interface TranscriptViewerProps {
  segments: TSegment[];
  currentVideoTime?: number;
  onSegmentClick?: (startTime: number) => void;
  meetingId?: string;
}

export function TranscriptViewer({
  segments,
  currentVideoTime = 0,
  onSegmentClick,
  meetingId,
}: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeakers, setSelectedSpeakers] = useState<Set<string>>(new Set());
  const [showSpeakerFilter, setShowSpeakerFilter] = useState(false);

  // Get unique speakers
  const speakers = useMemo(() => {
    const speakerSet = new Set(segments.map((s) => s.speaker_name));
    return Array.from(speakerSet);
  }, [segments]);

  // Find the active segment based on video time
  const activeSegmentIndex = useMemo(() => {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (currentVideoTime >= segments[i].start_time) {
        return i;
      }
    }
    return -1;
  }, [segments, currentVideoTime]);

  // Filter segments
  const filteredSegments = useMemo(() => {
    let result = segments;

    // Speaker filter
    if (selectedSpeakers.size > 0) {
      result = result.filter((s) => selectedSpeakers.has(s.speaker_name));
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.text.toLowerCase().includes(q) ||
          s.speaker_name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [segments, selectedSpeakers, searchQuery]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentRef.current && containerRef.current) {
      const container = containerRef.current;
      const element = activeSegmentRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      const isVisible =
        elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;

      if (!isVisible) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSegmentIndex]);

  // Toggle speaker filter
  const toggleSpeaker = (speaker: string) => {
    setSelectedSpeakers((prev) => {
      const next = new Set(prev);
      if (next.has(speaker)) next.delete(speaker);
      else next.add(speaker);
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 overflow-hidden"
      style={{ maxHeight: 'calc(100vh - 120px)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <ScrollText size={16} className="text-cyan" />
        <h3 className="text-sm font-medium text-white/90">Transcript</h3>
        <span className="ml-auto text-[10px] text-white/30">
          {filteredSegments.length} / {segments.length} segments
        </span>
      </div>

      {/* Search + Speaker filter */}
      <div className="px-3 py-2 border-b border-white/5 space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            type="text"
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white/80 placeholder-white/25 outline-none focus:border-cyan/40 transition-colors"
          />
        </div>

        {/* Speaker filter */}
        {speakers.length > 1 && (
          <div>
            <button
              onClick={() => setShowSpeakerFilter(!showSpeakerFilter)}
              className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60 transition-colors"
            >
              <Filter size={10} />
              Filter speakers
              {selectedSpeakers.size > 0 && (
                <span className="px-1.5 py-0 rounded-full bg-cyan/20 text-cyan text-[9px]">
                  {selectedSpeakers.size}
                </span>
              )}
            </button>
            {showSpeakerFilter && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {speakers.map((speaker) => (
                  <button
                    key={speaker}
                    onClick={() => toggleSpeaker(speaker)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                      selectedSpeakers.has(speaker)
                        ? 'bg-cyan/20 text-cyan border border-cyan/30'
                        : selectedSpeakers.size === 0
                        ? 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                        : 'bg-white/5 text-white/30 border border-white/5 hover:bg-white/10'
                    }`}
                  >
                    {speaker}
                  </button>
                ))}
                {selectedSpeakers.size > 0 && (
                  <button
                    onClick={() => setSelectedSpeakers(new Set())}
                    className="px-2 py-0.5 rounded-full text-[10px] text-white/30 hover:text-white/50 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Segments list */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-0">
        {filteredSegments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <ScrollText size={32} className="text-white/10 mb-3" />
            <p className="text-xs text-white/30">
              {segments.length === 0
                ? 'No transcript available yet'
                : 'No segments match your search'}
            </p>
          </div>
        ) : (
          filteredSegments.map((seg, i) => {
            const originalIndex = segments.indexOf(seg);
            const isActive = originalIndex === activeSegmentIndex;
            return (
              <div
                key={seg.id || i}
                ref={isActive ? activeSegmentRef : undefined}
              >
                <TranscriptSegment
                  segment={seg}
                  isActive={isActive}
                  onClick={() => onSegmentClick?.(seg.start_time)}
                />
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

export default TranscriptViewer;
