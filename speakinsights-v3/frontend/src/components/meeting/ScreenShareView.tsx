import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, MonitorOff } from 'lucide-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';

interface ScreenShareViewProps {
  /** LiveKit screen share track reference */
  trackRef?: TrackReferenceOrPlaceholder | null;
  /** Name of the participant sharing their screen */
  participantName?: string;
  /** Whether the current user is the one sharing (shows Stop Sharing button) */
  isLocalSharing?: boolean;
  /** Callback when the user clicks 'Stop Sharing' */
  onStopSharing?: () => void;
}

/**
 * Screen share view component.
 *
 * When screen sharing is active, this replaces or overlays the main video grid.
 * Shows the screen share track as a large video element with:
 * - Glass-surface pill label showing who is sharing
 * - 'Stop Sharing' button visible only to the person sharing
 * - Transition animation when screen share starts/stops
 */
export function ScreenShareView({
  trackRef,
  participantName,
  isLocalSharing = false,
  onStopSharing,
}: ScreenShareViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach/detach the screen share track to the video element
  useEffect(() => {
    if (videoRef.current && trackRef?.publication?.track) {
      trackRef.publication.track.attach(videoRef.current);
      console.log('[SpeakInsights] Screen share track attached');

      return () => {
        if (videoRef.current) {
          trackRef.publication?.track?.detach(videoRef.current);
          console.log('[SpeakInsights] Screen share track detached');
        }
      };
    }
  }, [trackRef]);

  const sharerName =
    participantName ||
    trackRef?.participant?.name ||
    trackRef?.participant?.identity ||
    'Someone';

  const hasTrack = !!trackRef?.publication?.track;

  return (
    <AnimatePresence mode="wait">
      {hasTrack ? (
        <motion.div
          key="screen-share-active"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative w-full h-full rounded-2xl overflow-hidden bg-black border border-white/10"
        >
          {/* Screen share video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />

          {/* Sharer label pill — glass surface */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.25 }}
            className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 shadow-lg"
          >
            <Monitor size={14} className="text-cyan-400" />
            <span className="text-xs font-medium text-cyan-400">
              {sharerName} is sharing their screen
            </span>
          </motion.div>

          {/* Stop Sharing button — only visible to the person sharing */}
          {isLocalSharing && onStopSharing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.25 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2"
            >
              <button
                onClick={onStopSharing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                  bg-red-500/80 hover:bg-red-500 backdrop-blur-md
                  border border-red-400/30
                  text-white text-sm font-semibold
                  shadow-lg shadow-red-500/20
                  transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <MonitorOff size={16} />
                Stop Sharing
              </button>
            </motion.div>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="screen-share-empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center justify-center h-full rounded-2xl bg-white/5 backdrop-blur-md border border-white/10"
        >
          <Monitor size={40} className="text-white/20 mb-3" />
          <p className="text-sm text-white/40">No screen being shared</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ScreenShareView;
