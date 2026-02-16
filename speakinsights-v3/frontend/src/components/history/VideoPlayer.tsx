import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { formatTimestamp } from '@/utils/formatTime';
import type { SentimentArcPoint } from '@/types/summary';

interface VideoPlayerProps {
  recordingUrl?: string;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
  sentimentArc?: SentimentArcPoint[];
  posterUrl?: string;
}

export function VideoPlayer({
  recordingUrl,
  currentTime: externalTime,
  onTimeUpdate,
  sentimentArc = [],
  posterUrl,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speeds = [0.5, 1, 1.5, 2];

  // Sync external time
  useEffect(() => {
    if (externalTime !== undefined && videoRef.current && Math.abs(videoRef.current.currentTime - externalTime) > 1) {
      videoRef.current.currentTime = externalTime;
    }
  }, [externalTime]);

  // Video event handlers
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);
    onTimeUpdate?.(t);
  }, [onTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  }, []);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);

  // Play/pause toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play().catch(() => {});
  }, [isPlaying]);

  // Seek
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = ratio * duration;
  }, [duration]);

  // Skip
  const skip = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
  }, [duration]);

  // Volume
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const muted = !isMuted;
    videoRef.current.muted = muted;
    setIsMuted(muted);
  }, [isMuted]);

  // Playback speed
  const setSpeed = useCallback((rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  }, []);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, skip, toggleMute, toggleFullscreen]);

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (isPlaying) {
      hideTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  // Progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Sentiment color for progress bar segments
  const getSentimentSegmentColor = (score: number) => {
    if (score >= 0.3) return 'rgba(52, 211, 153, 0.6)'; // green
    if (score <= -0.3) return 'rgba(248, 113, 113, 0.5)'; // red
    return 'rgba(251, 191, 36, 0.4)'; // yellow
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-glass-lg overflow-hidden bg-black border border-white/10 group"
      onMouseMove={showControlsTemporarily}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video element */}
      {recordingUrl ? (
        <video
          ref={videoRef}
          src={recordingUrl}
          poster={posterUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onClick={togglePlay}
          className="w-full aspect-video object-contain cursor-pointer"
          playsInline
        />
      ) : (
        <div className="w-full aspect-video flex flex-col items-center justify-center bg-gradient-to-br from-navy to-navy-light">
          <Play className="text-white/15 mb-3" size={64} />
          <p className="text-sm text-white/30">No recording available</p>
          <p className="text-xs text-white/15 mt-1">Recording will appear after meeting ends</p>
        </div>
      )}

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && recordingUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-3 px-4"
          >
            {/* Progress bar */}
            <div
              ref={progressRef}
              onClick={handleSeek}
              className="relative h-1.5 bg-white/10 rounded-full cursor-pointer mb-3 group/progress hover:h-2.5 transition-all"
            >
              {/* Sentiment overlay */}
              {sentimentArc.length > 0 && duration > 0 && (
                <div className="absolute inset-0 rounded-full overflow-hidden opacity-60">
                  {sentimentArc.map((point, i) => {
                    const nextPoint = sentimentArc[i + 1];
                    const start = (point.time / duration) * 100;
                    const width = nextPoint
                      ? ((nextPoint.time - point.time) / duration) * 100
                      : 100 - start;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0"
                        style={{
                          left: `${start}%`,
                          width: `${width}%`,
                          backgroundColor: getSentimentSegmentColor(point.score),
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Played portion */}
              <div
                className="absolute top-0 left-0 bottom-0 bg-cyan rounded-full z-10"
                style={{ width: `${progress}%` }}
              />

              {/* Scrubber dot */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan shadow-glow-cyan z-20 opacity-0 group-hover/progress:opacity-100 transition-opacity"
                style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
              />
            </div>

            <div className="flex items-center justify-between">
              {/* Left controls */}
              <div className="flex items-center gap-2">
                <button onClick={() => skip(-10)} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                  <SkipBack size={16} />
                </button>
                <button onClick={togglePlay} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                </button>
                <button onClick={() => skip(10)} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                  <SkipForward size={16} />
                </button>

                {/* Time display */}
                <span className="text-xs text-white/60 font-mono ml-2">
                  {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
                </span>
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-2">
                {/* Volume */}
                <button onClick={toggleMute} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>

                {/* Playback speed */}
                <div className="relative">
                  <button
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="px-2 py-1 rounded-lg text-[11px] font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {playbackRate}x
                  </button>
                  <AnimatePresence>
                    {showSpeedMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute bottom-full mb-2 right-0 rounded-lg bg-navy-light/95 backdrop-blur-xl border border-white/10 overflow-hidden"
                      >
                        {speeds.map((s) => (
                          <button
                            key={s}
                            onClick={() => setSpeed(s)}
                            className={`block w-full px-4 py-1.5 text-xs text-left transition-colors ${
                              playbackRate === s ? 'text-cyan bg-cyan/10' : 'text-white/60 hover:bg-white/5'
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Fullscreen */}
                <button onClick={toggleFullscreen} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                  {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Big play button overlay when paused */}
      {recordingUrl && !isPlaying && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <Play size={28} className="text-white ml-1" />
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
