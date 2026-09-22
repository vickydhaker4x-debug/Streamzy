import React, { useState, useMemo } from 'react';
import { ArrowLeft, Heart, Play, Shuffle, DownloadCloud, Search, CheckCircle2, Download } from 'lucide-react';
import { Track } from '../../types';
import { TrackImage } from '../TrackImage';
import { formatTotalDuration } from '../../services/libraryDataService';

interface LikedSongsViewProps {
  likedTracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onPlayQueue: (tracks: Track[], startIndex?: number) => void;
  onToggleFavorite: (trackId: string) => void;
  onToggleDownload: (track: Track) => void;
  onDownloadAll: (tracks: Track[]) => void;
  isDownloaded: (trackId: string) => boolean;
  onBack?: () => void;
}

export const LikedSongsView: React.FC<LikedSongsViewProps> = ({
  likedTracks,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onPlayQueue,
  onToggleFavorite,
  onToggleDownload,
  onDownloadAll,
  isDownloaded,
  onBack
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'artist'>('recent');

  const totalSec = useMemo(
    () => likedTracks.reduce((sum, t) => sum + (t.durationSec || 200), 0),
    [likedTracks]
  );
  const totalDurationFormatted = useMemo(() => formatTotalDuration(totalSec), [totalSec]);

  // Filter and Sort
  const processedTracks = useMemo(() => {
    let list = [...likedTracks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || (t.album && t.album.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'artist') {
      list.sort((a, b) => a.artist.localeCompare(b.artist));
    }

    return list;
  }, [likedTracks, searchQuery, sortBy]);

  const handleShuffle = () => {
    if (processedTracks.length === 0) return;
    const shuffled = [...processedTracks].sort(() => Math.random() - 0.5);
    onPlayQueue(shuffled, 0);
  };

  return (
    <div id="liked-songs-view" className="flex flex-col gap-5 animate-fade-in">
      {onBack && (
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[13px] font-bold text-[#a1a1aa] hover:text-[#e4e1e7] transition-colors cursor-pointer py-1"
          >
            <ArrowLeft size={18} />
            Back
          </button>
        </div>
      )}

      {/* Hero Banner for Liked Songs Playlist */}
      <div className="p-5 sm:p-6 rounded-3xl liquid-glass border border-white/[0.08] shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Dynamic collage or glowing heart art */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[#ff4760] flex items-center justify-center text-white shrink-0 shadow-lg shadow-[var(--color-primary)]/20 relative overflow-hidden">
          {likedTracks.length >= 4 ? (
            <div className="grid grid-cols-2 w-full h-full">
              {likedTracks.slice(0, 4).map((t) => (
                <TrackImage
                  key={t.id}
                  src={t.coverUrl}
                  videoId={t.videoId}
                  alt={t.title}
                  className="w-full h-full object-cover opacity-80"
                />
              ))}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Heart size={32} className="text-white fill-current" />
              </div>
            </div>
          ) : (
            <Heart size={44} className="text-white fill-current" />
          )}
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
            Auto-Generated Playlist • Live Sync
          </span>
          <h1 className="text-[22px] sm:text-[26px] font-black text-[#e4e1e7] truncate mt-0.5">
            Liked Songs
          </h1>
          <div className="flex items-center gap-2 mt-1.5 text-[12px] text-[#a1a1aa]">
            <span>{likedTracks.length} {likedTracks.length === 1 ? 'track' : 'tracks'}</span>
            <span>•</span>
            <span>{totalDurationFormatted}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          {likedTracks.length > 0 && (
            <>
              <button
                id="play-all-liked-btn"
                onClick={() => onPlayQueue(processedTracks, 0)}
                className="px-5 py-2.5 rounded-full bg-[var(--color-primary)] text-[#670211] text-[13px] font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer floating-btn"
              >
                <Play size={18} className="fill-current" />
                Play All
              </button>

              <button
                id="shuffle-liked-btn"
                onClick={handleShuffle}
                className="w-10 h-10 rounded-full liquid-glass hover:bg-white/20 text-[#e4e1e7] flex items-center justify-center transition-all cursor-pointer active:scale-95 border border-white/10"
                title="Shuffle Liked Songs"
              >
                <Shuffle size={18} />
              </button>

              <button
                id="download-all-liked-btn"
                onClick={() => onDownloadAll(likedTracks)}
                className="w-10 h-10 rounded-full liquid-glass hover:bg-white/20 text-emerald-400 flex items-center justify-center transition-all cursor-pointer active:scale-95 border border-white/10"
                title="Download All Liked Songs"
              >
                <DownloadCloud size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search & Sort bar */}
      {likedTracks.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-2.5 text-[#a1a1aa]" />
            <input
              id="search-liked-songs-input"
              type="text"
              placeholder="Search in Liked Songs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-2xl liquid-glass border border-white/[0.08] text-[13px] text-[#e4e1e7] placeholder-[#71717a] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto text-[12px]">
            <span className="text-[#a1a1aa] mr-1 text-[11px]">Sort:</span>
            {(['recent', 'title', 'artist'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSortBy(mode)}
                className={`px-3 py-1.5 rounded-full font-semibold capitalize transition-all cursor-pointer ${
                  sortBy === mode
                    ? 'bg-[var(--color-primary)] text-[#670211]'
                    : 'bg-white/[0.06] text-[#a1a1aa] hover:text-[#e4e1e7]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Song List */}
      {likedTracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-10 liquid-glass rounded-3xl border border-white/[0.04] my-2">
          <div className="w-16 h-16 rounded-2xl liquid-glass text-[#a1a1aa] flex items-center justify-center mb-3">
            <Heart size={32} />
          </div>
          <h3 className="text-[17px] font-bold text-[#e4e1e7]">No Liked Songs Yet</h3>
          <p className="text-[13px] text-[#a1a1aa] max-w-sm mt-1">
            Tap the heart icon on any song across Top Streaming, Search, or Player to auto-generate your personal favorites playlist.
          </p>
        </div>
      ) : processedTracks.length === 0 ? (
        <div className="p-8 text-center text-[#a1a1aa] text-[13px] liquid-glass rounded-2xl">
          No songs match &quot;{searchQuery}&quot; in Liked Songs.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {processedTracks.map((track, idx) => {
            const isThisActive = currentTrack?.id === track.id;
            const downloaded = isDownloaded(track.id);

            return (
              <div
                key={track.id}
                id={`liked-track-${track.id}`}
                onClick={() => onPlayQueue(processedTracks, idx)}
                className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer border transition-all ${
                  isThisActive
                    ? 'liquid-glass/90 border-[var(--color-primary)]/40 ring-1 ring-[var(--color-primary)]/25 shadow-md'
                    : 'liquid-glass hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_8px_20px_0_rgba(0,0,0,0.25)] hover:scale-[1.01] border-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-5 text-center shrink-0">
                    {isThisActive && isPlaying ? (
                      <div className="flex items-end gap-0.5 h-3.5 justify-center">
                        <span className="w-0.5 bg-[var(--color-primary)] rounded-full animate-bounce h-2.5"></span>
                        <span className="w-0.5 bg-[var(--color-primary)] rounded-full animate-bounce h-3.5 delay-75"></span>
                        <span className="w-0.5 bg-[var(--color-primary)] rounded-full animate-bounce h-2 delay-150"></span>
                      </div>
                    ) : (
                      <span className="text-[12px] font-mono text-[#71717a]">{idx + 1}</span>
                    )}
                  </div>

                  <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 liquid-glass-heavy">
                    <TrackImage
                      src={track.coverUrl}
                      videoId={track.videoId}
                      alt={track.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className={`text-[14px] font-bold truncate ${isThisActive ? 'text-[var(--color-primary)]' : 'text-[#e4e1e7]'}`}>
                      {track.title}
                    </span>
                    <span className="text-[12px] text-[#a1a1aa] truncate mt-0.5">
                      {track.artist} • {track.album}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    aria-label="Toggle download"
                    onClick={() => onToggleDownload(track)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      downloaded ? 'text-emerald-400 bg-emerald-500/10' : 'text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/5'
                    }`}
                  >
                    {downloaded ? <CheckCircle2 size={16} /> : <Download size={16} />}
                  </button>

                  <button
                    aria-label="Remove from favorites"
                    onClick={() => onToggleFavorite(track.id)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-primary)] hover:bg-white/5 active:scale-90 transition-all cursor-pointer"
                  >
                    <Heart size={16} className="fill-current" />
                  </button>

                  <span className="text-[12px] text-[#a1a1aa] font-mono min-w-[36px] text-right">
                    {track.duration}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
