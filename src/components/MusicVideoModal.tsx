import React, { useState } from 'react';
import { MusicVideoItem, Track } from '../types';

interface MusicVideoModalProps {
  video: MusicVideoItem | null;
  onClose: () => void;
  onPlayAudioOnly: (video: MusicVideoItem) => void;
}

export const MusicVideoModal: React.FC<MusicVideoModalProps> = ({
  video,
  onClose,
  onPlayAudioOnly
}) => {
  const [isPlayingInline, setIsPlayingInline] = useState(true);

  if (!video) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-[#0f0f13] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video Player Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shrink-0" />
            <span className="text-[13px] font-bold text-white uppercase tracking-wider truncate">
              YouTube Music Video
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined floating-icon text-[20px]">close</span>
          </button>
        </div>

        {/* 16:9 Video Embed */}
        <div className="relative w-full aspect-video bg-black">
          {isPlayingInline ? (
            <iframe
              className="w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <img 
                src={video.thumbnailUrl} 
                alt={video.title} 
                className="w-full h-full object-cover opacity-60"
              />
              <button 
                onClick={() => setIsPlayingInline(true)}
                className="absolute w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-transform cursor-pointer"
              >
                <span className="material-symbols-outlined floating-icon text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  play_arrow
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Video Info and Controls */}
        <div className="p-4 sm:p-5 flex flex-col gap-3 bg-[#121217]">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
              {video.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-xs sm:text-sm text-zinc-400">
              <span className="font-semibold text-zinc-300">{video.artist}</span>
              <span>•</span>
              <span>{video.views}</span>
              <span>•</span>
              <span>{video.duration}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-white/10">
            <button
              onClick={() => {
                onPlayAudioOnly(video);
                onClose();
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined floating-icon text-[18px]">graphic_eq</span>
              Stream Audio Only (Background)
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: video.title,
                    url: `https://www.youtube.com/watch?v=${video.videoId}`
                  }).catch(() => {});
                }
              }}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
              title="Share"
            >
              <span className="material-symbols-outlined floating-icon text-[18px]">share</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
