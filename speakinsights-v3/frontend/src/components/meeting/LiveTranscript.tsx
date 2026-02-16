import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, Subtitles } from 'lucide-react';
import { useTranscriptStore } from '@/stores/transcriptStore';
import { formatTimestamp } from '@/utils/formatTime';
import { getSentimentColor } from '@/utils/colors';
import { getAvatarColor } from '@/utils/colors';

type TabType = 'captions' | 'transcript';

interface CaptionEntry {
  id: string;
  text: string;
  speaker: string;
  timestamp: number;
}

interface LiveTranscriptProps {
  captions?: CaptionEntry[];
  currentCaption?: string;
  participantName?: string;
}

export function LiveTranscript({
  captions = [],
  currentCaption = '',
  participantName = '',
}: LiveTranscriptProps) {
  const [activeTab, setActiveTab] = useState<TabType>('transcript');
  const transcriptBottomRef = useRef<HTMLDivElement>(null);
  const captionsBottomRef = useRef<HTMLDivElement>(null);

  const { segments } = useTranscriptStore();

  // Auto-scroll transcript
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments]);

  // Auto-scroll captions
  useEffect(() => {
    captionsBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [captions, currentCaption]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab headers */}
      <div className="flex border-b border-white/5">
        <button
          onClick={() => setActiveTab('captions')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'captions'
              ? 'text-cyan border-b-2 border-cyan bg-cyan/5'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          <Subtitles size={14} />
          Captions
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'transcript'
              ? 'text-cyan border-b-2 border-cyan bg-cyan/5'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          <ScrollText size={14} />
          Transcript
          {segments.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/10 text-[10px]">
              {segments.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <AnimatePresence mode="wait">
          {/* Captions Tab */}
          {activeTab === 'captions' && (
            <motion.div
              key="captions"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="p-3 space-y-2"
            >
              {captions.length === 0 && !currentCaption && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Subtitles size={24} className="text-white/15 mb-2" />
                  <p className="text-xs text-white/30">
                    Enable captions to see live speech
                  </p>
                  <p className="text-[10px] text-white/20 mt-1">
                    Works best in Chrome/Edge
                  </p>
                </div>
              )}

              {captions.map((cap) => (
                <motion.div
                  key={cap.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs"
                >
                  <span
                    className="font-medium mr-1.5"
                    style={{ color: getAvatarColor(cap.speaker) }}
                  >
                    {cap.speaker}:
                  </span>
                  <span className="text-white/70">{cap.text}</span>
                </motion.div>
              ))}

              {/* Current (interim) caption */}
              {currentCaption && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs"
                >
                  <span
                    className="font-medium mr-1.5"
                    style={{ color: getAvatarColor(participantName) }}
                  >
                    {participantName}:
                  </span>
                  <span className="text-white/40 italic">{currentCaption}</span>
                </motion.div>
              )}

              <div ref={captionsBottomRef} />
            </motion.div>
          )}

          {/* Transcript Tab */}
          {activeTab === 'transcript' && (
            <motion.div
              key="transcript"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="p-3 space-y-2"
            >
              {segments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ScrollText size={24} className="text-white/15 mb-2" />
                  <p className="text-xs text-white/30">
                    Waiting for speech...
                  </p>
                  <p className="text-[10px] text-white/20 mt-1">
                    WhisperX transcript arrives with ~20s delay
                  </p>
                </div>
              )}

              {segments.map((seg, i) => (
                <motion.div
                  key={seg.id || i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-lg px-3 py-2 bg-white/5 border border-white/5"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className="text-xs font-medium"
                      style={{ color: getAvatarColor(seg.speaker_name) }}
                    >
                      {seg.speaker_name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {seg.sentiment_score != null && (
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: getSentimentColor(seg.sentiment_score) }}
                          title={`Sentiment: ${seg.sentiment_label || seg.sentiment_score.toFixed(2)}`}
                        />
                      )}
                      <span className="text-[10px] text-white/30 font-mono">
                        {formatTimestamp(seg.start_time)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">
                    {seg.text}
                  </p>
                </motion.div>
              ))}

              <div ref={transcriptBottomRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default LiveTranscript;
