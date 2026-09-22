import React from 'react';
import { motion } from 'motion/react';
import { Track } from '../types';
import { TrackImage } from './TrackImage';

interface MiniPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTimeSec: number;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onOpenNowPlaying: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentTrack,
  isPlaying,
  currentTimeSec,
  onTogglePlay,
  onNextTrack,
  onOpenNowPlaying
}) => {
  if (!currentTrack) return null;

  const progressPercent = Math.min(100, (currentTimeSec / (currentTrack.durationSec || 1)) * 100);

  return (
    <motion.aside 
      id="mini-player-dock"
      initial={{ y: 60, opacity: 0, scale: 0.97 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 60, opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', damping: 26, stiffness: 340 }}
      className="fixed bottom-[74px] sm:bottom-[78px] inset-x-0 z-30 px-3 sm:px-4 pointer-events-none gpu-layer"
    >
      <div 
        className="pointer-events-auto mx-auto max-w-lg liquid-glass-heavy rounded-2xl overflow-hidden border border-white/[0.12] shadow-[0_12px_36px_rgba(0,0,0,0.65)] transition-all duration-300 hover:shadow-[0_16px_44px_rgba(0,0,0,0.8)]"
      >
        <div className="h-15 px-3.5 flex items-center justify-between gap-3">
          {/* Clickable info area that expands to Now Playing */}
          <button 
            id="mini-player-expand-btn"
            onClick={onOpenNowPlaying}
            className="flex items-center gap-3 min-w-0 flex-1 text-left group cursor-pointer focus:outline-none transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
            aria-label="Expand player"
          >
            <div className="relative w-11 h-11 rounded-xl liquid-glass overflow-hidden shrink-0 shadow-md flex items-center justify-center border border-white/[0.1] group-hover:scale-105 transition-transform duration-300">
              <TrackImage 
                src={currentTrack.coverUrl} 
                videoId={currentTrack.videoId}
                alt={currentTrack.title}
                className="w-full h-full object-cover" 
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-ping"></span>
                </div>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-[14px] text-[#f4f4f5] font-semibold truncate leading-tight group-hover:text-[var(--color-primary)] transition-colors duration-200">
                {currentTrack.title}
              </span>
              <div className="flex items-center gap-2 mt-0.5 min-w-0">
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  {currentTrack.artist}
                </span>
              </div>
            </div>
          </button>

          {/* Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button 
              id="mini-player-play-btn"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePlay();
              }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--color-primary)] text-[#6c0513] shadow-[0_2px_14px_rgba(248,113,113,0.4)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg active:scale-90 transition-all duration-300 cursor-pointer"
            >
              <span 
                className="material-symbols-outlined floating-icon text-[22px]" 
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            <button 
              id="mini-player-next-btn"
              aria-label="Next Track"
              onClick={(e) => {
                e.stopPropagation();
                onNextTrack();
              }}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-white/[0.08] hover:-translate-y-0.5 hover:shadow-md active:scale-90 transition-all duration-300 cursor-pointer"
            >
              <span 
                className="material-symbols-outlined floating-icon text-[22px]" 
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                skip_next
              </span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full liquid-glass h-[3px] relative overflow-hidden">
          <div 
            className="bg-gradient-to-r from-[var(--color-primary)] to-[#FF8BA0] h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(248,113,113,0.85)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </motion.aside>
  );
};
