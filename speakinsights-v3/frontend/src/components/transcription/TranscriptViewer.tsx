import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, Search, Filter, Pencil, Check, X, Loader2, GitMerge } from 'lucide-react';
import { TranscriptSegment } from './TranscriptSegment';
import { transcriptions } from '@/services/api';
import { getAvatarColor } from '@/utils/colors';
import type { TranscriptSegment as TSegment } from '@/types/transcription';

interface TranscriptViewerProps {
  segments: TSegment[];
  currentVideoTime?: number;
  onSegmentClick?: (startTime: number) => void;
  meetingId?: string;
  onSpeakersRenamed?: () => void;
}

export function TranscriptViewer({
  segments,
  currentVideoTime = 0,
  onSegmentClick,
  meetingId,
  onSpeakersRenamed,
}: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeakers, setSelectedSpeakers] = useState<Set<string>>(new Set());
  const [showSpeakerFilter, setShowSpeakerFilter] = useState(false);

  // Speaker rename state
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Speaker merge state
  const [mergingSpeaker, setMergingSpeaker] = useState<string | null>(null);

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

  // Focus the edit input when editing starts
  useEffect(() => {
    if (editingSpeaker && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSpeaker]);

  // Toggle speaker filter
  const toggleSpeaker = (speaker: string) => {
    setSelectedSpeakers((prev) => {
      const next = new Set(prev);
      if (next.has(speaker)) next.delete(speaker);
      else next.add(speaker);
      return next;
    });
  };

  // Start editing a speaker name
  const startEditing = useCallback((speaker: string) => {
    setEditingSpeaker(speaker);
    setEditValue(speaker);
  }, []);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingSpeaker(null);
    setEditValue('');
  }, []);

  // Submit rename
  const submitRename = useCallback(async () => {
    if (!meetingId || !editingSpeaker || !editValue.trim() || editValue.trim() === editingSpeaker) {
      cancelEditing();
      return;
    }

    setRenaming(true);
    try {
      await transcriptions.renameSpeakers(meetingId, { [editingSpeaker]: editValue.trim() });
      cancelEditing();
      onSpeakersRenamed?.();
    } catch (err) {
      console.error('Failed to rename speaker:', err);
    } finally {
      setRenaming(false);
    }
  }, [meetingId, editingSpeaker, editValue, cancelEditing, onSpeakersRenamed]);

  // Handle enter/escape in edit input
  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitRename();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  }, [submitRename, cancelEditing]);

  // Merge speaker into another (rename source to target name)
  const mergeSpeaker = useCallback(async (source: string, target: string) => {
    if (!meetingId || source === target) return;
    setRenaming(true);
    try {
      await transcriptions.renameSpeakers(meetingId, { [source]: target });
      setMergingSpeaker(null);
      onSpeakersRenamed?.();
    } catch (err) {
      console.error('Failed to merge speaker:', err);
    } finally {
      setRenaming(false);
    }
  }, [meetingId, onSpeakersRenamed]);

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

        {/* Speaker filter + rename */}
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
            <AnimatePresence>
              {showSpeakerFilter && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-1.5 mt-2">
                    {speakers.map((speaker) => (
                      <div key={speaker} className="flex items-center gap-1.5 group">
                        {editingSpeaker === speaker ? (
                          /* Inline edit mode */
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              disabled={renaming}
                              className="flex-1 px-2 py-1 rounded-lg bg-white/10 border border-cyan/30 text-[11px] text-white
                                outline-none focus:border-cyan/60 transition-colors min-w-0 font-medium"
                              placeholder="Enter name..."
                            />
                            <button
                              onClick={submitRename}
                              disabled={renaming || !editValue.trim() || editValue.trim() === editingSpeaker}
                              className="p-1 rounded-md hover:bg-emerald-500/20 text-emerald-400 disabled:opacity-30 transition-colors cursor-pointer"
                              title="Save"
                            >
                              {renaming ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={renaming}
                              className="p-1 rounded-md hover:bg-red-500/20 text-red-400 disabled:opacity-30 transition-colors cursor-pointer"
                              title="Cancel"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          /* Normal display mode */
                          <>
                            <button
                              onClick={() => toggleSpeaker(speaker)}
                              className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                                selectedSpeakers.has(speaker)
                                  ? 'bg-cyan/20 text-cyan border border-cyan/30'
                                  : selectedSpeakers.size === 0
                                  ? 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                                  : 'bg-white/5 text-white/30 border border-white/5 hover:bg-white/10'
                              }`}
                            >
                              <span
                                className="inline-block w-1.5 h-1.5 rounded-full mr-1"
                                style={{ backgroundColor: getAvatarColor(speaker) }}
                              />
                              {speaker}
                            </button>
                            {meetingId && (
                              <>
                                <button
                                  onClick={() => startEditing(speaker)}
                                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/30 hover:text-cyan transition-all cursor-pointer"
                                  title={`Rename "${speaker}"`}
                                >
                                  <Pencil size={10} />
                                </button>
                                {speakers.length > 1 && (
                                  <div className="relative">
                                    <button
                                      onClick={() => setMergingSpeaker(mergingSpeaker === speaker ? null : speaker)}
                                      className={`p-1 rounded-md transition-all cursor-pointer ${
                                        mergingSpeaker === speaker
                                          ? 'opacity-100 bg-amber-500/20 text-amber-400'
                                          : 'opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/30 hover:text-amber-400'
                                      }`}
                                      title={`Merge "${speaker}" into another speaker`}
                                    >
                                      <GitMerge size={10} />
                                    </button>
                                    {/* Merge dropdown */}
                                    <AnimatePresence>
                                      {mergingSpeaker === speaker && (
                                        <motion.div
                                          initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                          animate={{ opacity: 1, scale: 1, y: 0 }}
                                          exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                          className="absolute left-0 top-full mt-1 z-20 min-w-[140px] py-1 rounded-lg bg-[#1a2332] border border-white/15 shadow-xl shadow-black/40"
                                        >
                                          <div className="px-2 py-1 text-[9px] text-white/30 uppercase tracking-wider">Merge into</div>
                                          {speakers.filter(s => s !== speaker).map(target => (
                                            <button
                                              key={target}
                                              onClick={() => mergeSpeaker(speaker, target)}
                                              disabled={renaming}
                                              className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] text-white/70 hover:bg-cyan/10 hover:text-cyan transition-colors disabled:opacity-30 cursor-pointer"
                                            >
                                              <span
                                                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: getAvatarColor(target) }}
                                              />
                                              {target}
                                            </button>
                                          ))}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                    {selectedSpeakers.size > 0 && (
                      <button
                        onClick={() => setSelectedSpeakers(new Set())}
                        className="px-2 py-0.5 rounded-full text-[10px] text-white/30 hover:text-white/50 transition-colors self-start"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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

