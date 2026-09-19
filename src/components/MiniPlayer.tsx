import React from 'react';
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
    <aside 
      id="mini-player-dock"
      className="fixed bottom-[74px] sm:bottom-[78px] inset-x-0 z-30 px-3 sm:px-4 pointer-events-none transition-all duration-300"
    >
      <div 
        className="pointer-events-auto mx-auto max-w-lg liquid-glass-heavy overflow-hidden transition-all duration-200"
      >
        <div className="h-14 px-3.5 flex items-center justify-between gap-3">
          {/* Clickable info area that expands to Now Playing */}
          <button 
            id="mini-player-expand-btn"
            onClick={onOpenNowPlaying}
            className="flex items-center gap-3 min-w-0 flex-1 text-left group cursor-pointer focus:outline-none floating-btn"
            aria-label="Expand player"
          >
            <div className="relative w-10 h-10 rounded-xl liquid-glass overflow-hidden shrink-0 shadow-sm flex items-center justify-center border border-white/[0.08] group-hover:scale-105 transition-transform">
              <TrackImage 
                src={currentTrack.coverUrl} 
                videoId={currentTrack.videoId}
                alt={currentTrack.title}
                className="w-full h-full object-cover" 
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-ping"></span>
                </div>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-[14px] text-[#f4f4f5] font-semibold truncate leading-tight group-hover:text-[var(--color-primary)] transition-colors">
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
          <div className="flex items-center gap-1 shrink-0">
            <button 
              id="mini-player-play-btn"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePlay();
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--color-primary)] text-[#6c0513] shadow-[0_2px_12px_rgba(248,113,113,0.35)] hover:brightness-110 active:scale-90 transition-all cursor-pointer"
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
              className="w-10 h-10 flex items-center justify-center rounded-full text-[#a1a1aa] hover:text-[#f4f4f5] hover:liquid-glass active:scale-90 transition-all cursor-pointer"
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
        <div className="w-full liquid-glass h-[2.5px] relative">
          <div 
            className="bg-[var(--color-primary)] h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(248,113,113,0.8)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </aside>
  );
};
