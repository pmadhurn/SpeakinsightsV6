import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useParticipants,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { VideoTile } from './VideoTile';
import { ScreenShareView } from './ScreenShareView';

export function VideoGrid() {
  const participants = useParticipants();
  const screenShareTracks = useTracks([Track.Source.ScreenShare]);

  const screenShareTrack = screenShareTracks.length > 0 ? screenShareTracks[0] : null;
  const hasScreenShare = !!screenShareTrack;

  // Find the active speaker (the one currently speaking)
  const activeSpeaker = useMemo(() => {
    return participants.find((p) => p.isSpeaking) || null;
  }, [participants]);

  // Layout logic based on participant count and screen share
  const getLayout = () => {
    const count = participants.length;

    if (hasScreenShare) {
      return 'screen-share';
    }
    if (count <= 1) return 'single';
    if (count === 2) return 'split';
    if (count <= 4) return 'grid-2x2';
    if (count <= 9) return 'active-speaker-side';
    return 'active-speaker-grid';
  };

  const layout = getLayout();

  // For active speaker layouts, separate the active speaker from the rest
  const mainParticipant = activeSpeaker || participants[0];
  const sideParticipants = participants.filter((p) => p.identity !== mainParticipant?.identity);

  return (
    <div className="w-full h-full relative">
      <AnimatePresence mode="popLayout">
        {/* Screen Share Layout */}
        {layout === 'screen-share' && screenShareTrack && (
          <div className="flex h-full gap-3 p-3">
            {/* Screen share takes most space */}
            <div className="flex-1 min-w-0">
              <ScreenShareView trackRef={screenShareTrack} />
            </div>
            {/* All participants in a side strip */}
            <div className="w-48 flex flex-col gap-2 overflow-y-auto">
              {participants.map((p) => (
                <motion.div
                  key={p.identity}
                  layout
                  className="h-28 flex-shrink-0"
                >
                  <VideoTile
                    participant={p}
                    size="small"
                    isActive={p.isSpeaking}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Single participant - full screen */}
        {layout === 'single' && participants.length > 0 && (
          <div className="w-full h-full p-3">
            <VideoTile
              participant={participants[0]}
              size="large"
              isActive
            />
          </div>
        )}

        {/* Two participants - 50/50 split */}
        {layout === 'split' && (
          <div className="grid grid-cols-2 gap-3 p-3 h-full">
            {participants.map((p) => (
              <VideoTile
                key={p.identity}
                participant={p}
                size="large"
                isActive={p.isSpeaking}
              />
            ))}
          </div>
        )}

        {/* 3-4 participants - 2x2 grid with active speaker emphasis */}
        {layout === 'grid-2x2' && (
          <div className="h-full p-3">
            {activeSpeaker ? (
              <div className="flex h-full gap-3">
                {/* Active speaker large */}
                <div className="flex-[2] min-w-0">
                  <VideoTile
                    participant={mainParticipant}
                    size="large"
                    isActive
                  />
                </div>
                {/* Others on the side */}
                <div className="flex-1 flex flex-col gap-3">
                  {sideParticipants.map((p) => (
                    <div key={p.identity} className="flex-1 min-h-0">
                      <VideoTile
                        participant={p}
                        size="medium"
                        isActive={p.isSpeaking}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 grid-rows-2 gap-3 h-full">
                {participants.map((p) => (
                  <VideoTile
                    key={p.identity}
                    participant={p}
                    size="medium"
                    isActive={p.isSpeaking}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5-9 participants - active speaker large + side strip */}
        {layout === 'active-speaker-side' && (
          <div className="flex h-full gap-3 p-3">
            {/* Active speaker / main view */}
            <div className="flex-[3] min-w-0">
              <VideoTile
                participant={mainParticipant}
                size="large"
                isActive
              />
            </div>
            {/* Side strip */}
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-w-[160px]">
              {sideParticipants.map((p) => (
                <motion.div
                  key={p.identity}
                  layout
                  className="flex-shrink-0"
                  style={{ height: `${Math.max(100 / sideParticipants.length, 15)}%` }}
                >
                  <VideoTile
                    participant={p}
                    size="small"
                    isActive={p.isSpeaking}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* 10-20 participants - active speaker + 2 rows of tiles */}
        {layout === 'active-speaker-grid' && (
          <div className="flex flex-col h-full gap-3 p-3">
            {/* Active speaker - takes 60% */}
            <div className="flex-[3] min-h-0">
              <VideoTile
                participant={mainParticipant}
                size="large"
                isActive
              />
            </div>
            {/* Bottom tiles - scrollable rows */}
            <div className="flex-[1] min-h-0 overflow-x-auto">
              <div className="flex gap-2 h-full">
                {sideParticipants.map((p) => (
                  <motion.div
                    key={p.identity}
                    layout
                    className="flex-shrink-0 w-36 h-full"
                  >
                    <VideoTile
                      participant={p}
                      size="small"
                      isActive={p.isSpeaking}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* No participants */}
        {participants.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-white/40">Waiting for participants...</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default VideoGrid;
