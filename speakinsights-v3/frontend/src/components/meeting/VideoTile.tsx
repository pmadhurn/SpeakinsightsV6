import { useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MicOff, VideoOff } from 'lucide-react';
import { Track } from 'livekit-client';
import { useParticipantTracks, useIsSpeaking } from '@livekit/components-react';
import type { Participant as LKParticipant } from 'livekit-client';
import Avatar from '@/components/ui/Avatar';

interface VideoTileProps {
  participant: LKParticipant;
  isActive?: boolean;
  size?: 'large' | 'medium' | 'small';
}

export function VideoTile({ participant, isActive = false, size = 'medium' }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSpeaking = useIsSpeaking(participant);

  // Get tracks for this participant
  const trackRefs = useParticipantTracks(
    [Track.Source.Camera, Track.Source.Microphone],
    participant.identity
  );

  const cameraTrack = useMemo(
    () => trackRefs.find((t) => t.source === Track.Source.Camera),
    [trackRefs]
  );

  const micTrack = useMemo(
    () => trackRefs.find((t) => t.source === Track.Source.Microphone),
    [trackRefs]
  );

  const isCameraOn = !!cameraTrack?.publication?.track && !cameraTrack.publication.isMuted;
  const isMicMuted = !micTrack?.publication?.track || micTrack.publication.isMuted;

  // Attach video track to video element
  useEffect(() => {
    if (videoRef.current && cameraTrack?.publication?.track && isCameraOn) {
      cameraTrack.publication.track.attach(videoRef.current);
      return () => {
        if (videoRef.current) {
          cameraTrack.publication.track?.detach(videoRef.current);
        }
      };
    }
  }, [cameraTrack, isCameraOn]);

  const borderRadius = size === 'large' ? 'rounded-[20px]' : 'rounded-glass';
  const speakingBorder = isSpeaking || isActive
    ? 'ring-2 ring-cyan/50 shadow-glow-cyan'
    : 'border border-white/10';

  const name = participant.name || participant.identity;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`relative overflow-hidden bg-navy-light ${borderRadius} ${speakingBorder} transition-all duration-300 h-full w-full`}
    >
      {isCameraOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : (
        /* Avatar fallback when camera is off */
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-navy to-navy-light">
          <Avatar
            name={name}
            size={size === 'large' ? 'lg' : size === 'small' ? 'sm' : 'md'}
            className={`${size === 'large' ? 'w-20 h-20 text-2xl' : ''} ${
              isSpeaking ? 'ring-2 ring-cyan/50' : ''
            }`}
          />
          {size !== 'small' && (
            <div className="flex items-center gap-2">
              <VideoOff size={14} className="text-white/30" />
              <span className="text-xs text-white/40">Camera off</span>
            </div>
          )}
        </div>
      )}

      {/* Name label - bottom left */}
      <div className="absolute bottom-0 inset-x-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-white truncate">{name}</span>
        </div>

        {/* Mic indicator - bottom right */}
        <div className="flex-shrink-0 ml-2">
          {isMicMuted ? (
            <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <MicOff size={12} className="text-red-400" />
            </div>
          ) : isSpeaking ? (
            <div className="flex items-center gap-0.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-cyan rounded-full"
                  animate={{
                    height: [4, 12, 6, 14, 4],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.15,
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Speaking indicator glow - top right */}
      {isSpeaking && (
        <div className="absolute top-2 right-2">
          <span className="flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan" />
          </span>
        </div>
      )}
    </motion.div>
  );
}

export default VideoTile;
