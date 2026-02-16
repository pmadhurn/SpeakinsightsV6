import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Monitor } from 'lucide-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';

interface ScreenShareViewProps {
  trackRef?: TrackReferenceOrPlaceholder | null;
}

export function ScreenShareView({ trackRef }: ScreenShareViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && trackRef?.publication?.track) {
      trackRef.publication.track.attach(videoRef.current);
      return () => {
        if (videoRef.current) {
          trackRef.publication?.track?.detach(videoRef.current);
        }
      };
    }
  }, [trackRef]);

  if (!trackRef?.publication?.track) {
    return (
      <div className="flex flex-col items-center justify-center h-full rounded-glass-lg bg-white/5 backdrop-blur-md border border-white/10">
        <Monitor size={40} className="text-white/20 mb-3" />
        <p className="text-sm text-white/40">No screen being shared</p>
      </div>
    );
  }

  const sharerName = trackRef.participant?.name || trackRef.participant?.identity || 'Unknown';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative w-full h-full rounded-glass-lg overflow-hidden bg-black border border-white/10"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
        <Monitor size={12} className="text-cyan" />
        <span className="text-[10px] text-cyan font-medium">
          {sharerName}&apos;s Screen
        </span>
      </div>
    </motion.div>
  );
}

export default ScreenShareView;
