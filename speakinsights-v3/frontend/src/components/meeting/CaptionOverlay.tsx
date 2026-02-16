import { motion, AnimatePresence } from 'framer-motion';

interface CaptionOverlayProps {
  caption: string;
  speaker: string;
}

export function CaptionOverlay({ caption, speaker }: CaptionOverlayProps) {
  return (
    <AnimatePresence>
      {caption && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 max-w-[80%] z-20 pointer-events-none"
        >
          <div className="rounded-xl px-5 py-3 bg-black/70 backdrop-blur-lg border border-white/10 shadow-lg">
            <span className="text-xs font-semibold text-cyan mr-2">
              {speaker}:
            </span>
            <span className="text-sm text-white/90">{caption}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CaptionOverlay;
