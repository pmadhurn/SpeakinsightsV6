import { motion, AnimatePresence } from 'framer-motion';

interface CaptionItem {
  id: string;
  text: string;
  speaker: string;
  timestamp: number;
}

interface CaptionOverlayProps {
  /** Current interim/final caption being spoken */
  currentCaption?: {
    text: string;
    speaker: string;
  } | null;
  /** Recent finalized captions (last 3 shown with fade) */
  recentCaptions?: CaptionItem[];
  /** Whether captions are toggled on */
  visible?: boolean;
}

/**
 * Caption overlay positioned at the bottom center of the video area,
 * above the meeting controls bar.
 *
 * - Semi-transparent glass surface (bg black 40%, blur 16px)
 * - Current caption: larger text, white, speaker name in cyan
 * - Recent captions fade out above (last 3, decreasing opacity)
 * - Max width 70% of video area, centered
 * - Text shadow for readability over any video content
 */
export function CaptionOverlay({
  currentCaption,
  recentCaptions = [],
  visible = true,
}: CaptionOverlayProps) {
  if (!visible) return null;

  const hasContent = currentCaption?.text || recentCaptions.length > 0;
  if (!hasContent) return null;

  // Show last 3 recent captions with decreasing opacity
  const displayedRecent = recentCaptions.slice(-3);

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 max-w-[70%] w-auto z-20 pointer-events-none flex flex-col items-center gap-1.5">
      {/* Recent captions (fading out above current) */}
      <AnimatePresence mode="popLayout">
        {displayedRecent.map((caption, index) => {
          // Opacity decreases for older captions: 0.4, 0.55, 0.7
          const opacity = 0.4 + (index / displayedRecent.length) * 0.3;

          return (
            <motion.div
              key={caption.id}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="rounded-lg px-4 py-2 bg-black/30 backdrop-blur-md border border-white/5"
            >
              <span
                className="text-[11px] font-semibold mr-1.5"
                style={{
                  color: '#22D3EE',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}
              >
                {caption.speaker}:
              </span>
              <span
                className="text-xs text-white/70"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
              >
                {caption.text}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Current active caption */}
      <AnimatePresence>
        {currentCaption?.text && (
          <motion.div
            key="current-caption"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="rounded-xl px-5 py-3 bg-black/40 backdrop-blur-2xl border border-white/10 shadow-lg shadow-black/20"
          >
            <span
              className="text-xs font-bold mr-2 tracking-wide"
              style={{
                color: '#22D3EE',
                textShadow: '0 0 8px rgba(34,211,238,0.4), 0 1px 3px rgba(0,0,0,0.8)',
              }}
            >
              {currentCaption.speaker}:
            </span>
            <span
              className="text-sm text-white/90 font-medium"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
            >
              {currentCaption.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CaptionOverlay;
