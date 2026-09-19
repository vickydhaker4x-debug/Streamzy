import React, { useState, useEffect, useRef } from 'react';
import { Track, LyricsLine } from '../types';

interface FullscreenLyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  currentTimeSec: number;
  onSeek: (sec: number) => void;
}

const SAMPLE_LYRICS: { [key: string]: LyricsLine[] } = {
  default: [
    { time: 0, text: '♪ Instrumental intro ♪' },
    { time: 8, text: 'Tere bin lagda nahi dil mera dholna' },
    { time: 14, text: 'Puchh le gawah ne taare saare saajana' },
    { time: 21, text: 'Ve tere bin lagda nahi dil mera dholna' },
    { time: 28, text: 'Rabba mere ishq di ae taqdeer tu' },
    { time: 35, text: 'Mere har lafz di ae tasveer tu' },
    { time: 42, text: 'Tere bin chain nahi aave maahi' },
    { time: 49, text: 'Aaja ve dildar meri soniye' },
    { time: 56, text: '♪ Instrumental bridge ♪' },
    { time: 70, text: 'Sauda iss dil ka mushkil bada ae' },
    { time: 76, text: 'Har pal tere naal zinda khada ae' },
    { time: 84, text: 'Tu jo keh de taan mar jaavan' },
    { time: 91, text: 'Tu jo keh de taan has ke seh jaavan' },
    { time: 98, text: '♪ Outro ♪' }
  ]
};

export const FullscreenLyricsModal: React.FC<FullscreenLyricsModalProps> = ({
  isOpen,
  onClose,
  track,
  currentTimeSec,
  onSeek
}) => {
  const [offsetSec, setOffsetSec] = useState<number>(0);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Derive lyrics from track or sample fallback
  const lyrics: LyricsLine[] = (track?.lyrics as LyricsLine[]) || SAMPLE_LYRICS.default;

  const adjustedTime = Math.max(0, currentTimeSec + offsetSec);

  // Find active line index
  const activeIndex = lyrics.reduce((acc, line, idx) => {
    if (adjustedTime >= line.time) return idx;
    return acc;
  }, 0);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeIndex]);

  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0A040C] text-[#DAEAF7] flex flex-col justify-between p-4 sm:p-8">
      {/* Background artwork blur */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 filter blur-3xl scale-125">
        <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
      </div>

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between gap-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3 min-w-0">
          <img src={track.coverUrl} alt="" className="w-11 h-11 rounded-xl object-cover shadow-lg shrink-0" />
          <div className="min-w-0">
            <h3 className="font-bold text-base text-white truncate">{track.title}</h3>
            <span className="text-xs text-[#FE385E] font-medium truncate block">{track.artist}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Offset Adjusters */}
          <div className="flex items-center bg-[#170E1A] border border-[#2E1A31] rounded-xl px-2 py-1 gap-1 text-[11px] font-mono">
            <button
              onClick={() => setOffsetSec((o) => o - 0.5)}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 text-[#A193A5] hover:text-white"
              title="Minus 0.5s"
            >
              -0.5s
            </button>
            <span className="text-[#0EA5E0]">{offsetSec > 0 ? `+${offsetSec}` : offsetSec}s</span>
            <button
              onClick={() => setOffsetSec((o) => o + 0.5)}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 text-[#A193A5] hover:text-white"
              title="Plus 0.5s"
            >
              +0.5s
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </div>

      {/* Synced Lyrics Body */}
      <div
        ref={scrollContainerRef}
        className="relative z-10 flex-1 my-6 overflow-y-auto no-scrollbar max-w-2xl mx-auto w-full text-center flex flex-col gap-6 py-20 px-2"
      >
        {lyrics.map((line, idx) => {
          const isActive = idx === activeIndex;
          const isPassed = idx < activeIndex;

          return (
            <div
              key={`${line.time}-${idx}`}
              ref={isActive ? activeLineRef : null}
              onClick={() => onSeek(line.time)}
              className={`transition-all duration-300 cursor-pointer py-1.5 select-none rounded-xl px-4 ${
                isActive
                  ? 'text-white font-extrabold text-2xl sm:text-3xl scale-105 drop-shadow-[0_0_20px_rgba(254,56,94,0.6)] text-[#FE385E]'
                  : isPassed
                  ? 'text-[#58405E] text-lg sm:text-xl font-medium hover:text-[#A193A5]'
                  : 'text-[#A193A5] text-lg sm:text-xl font-medium hover:text-white'
              }`}
            >
              {line.text}
            </div>
          );
        })}
      </div>

      {/* Bottom Footer hint */}
      <div className="relative z-10 max-w-2xl mx-auto w-full text-center">
        <span className="text-[11px] text-[#A193A5] bg-[#140C16]/80 px-3 py-1 rounded-full border border-[#2D1A2F]">
          Tap any lyric line to jump directly to that timestamp
        </span>
      </div>
    </div>
  );
};
