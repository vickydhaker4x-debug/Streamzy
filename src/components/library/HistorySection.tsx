import React, { useState, useMemo } from 'react';
import { BarChart3, Search, Play, Trash2, AlertTriangle, History, Volume2, Clock, CheckCircle2, Download, Heart, X } from 'lucide-react';
import { Track } from '../../types';
import { TrackImage } from '../TrackImage';
import { calculateHistoryStats, formatRelativeTime } from '../../services/libraryDataService';

interface HistorySectionProps {
  playbackHistory: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onPlayHistoryQueue: (tracks: Track[], startIndex?: number) => void;
  onClearHistory: () => void;
  onRemoveFromHistory: (trackId: string) => void;
  onToggleFavorite: (trackId: string) => void;
  onToggleDownload: (track: Track) => void;
  isDownloaded: (trackId: string) => boolean;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  playbackHistory,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onPlayHistoryQueue,
  onClearHistory,
  onRemoveFromHistory,
  onToggleFavorite,
  onToggleDownload,
  isDownloaded
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const stats = useMemo(() => calculateHistoryStats(playbackHistory), [playbackHistory]);

  // Filter history by search query
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return playbackHistory;
    const q = searchQuery.toLowerCase();
    return playbackHistory.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || (t.album && t.album.toLowerCase().includes(q))
    );
  }, [playbackHistory, searchQuery]);

  // Group into chronological buckets
  const groupedHistory = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const today: Track[] = [];
    const yesterday: Track[] = [];
    const earlier: Track[] = [];

    filteredHistory.forEach((track) => {
      const time = track.playedAt || now;
      const diff = now - time;
      if (diff < oneDayMs) {
        today.push(track);
      } else if (diff < 2 * oneDayMs) {
        yesterday.push(track);
      } else {
        earlier.push(track);
      }
    });

    return [
      { label: 'Today & Recent', tracks: today },
      { label: 'Yesterday', tracks: yesterday },
      { label: 'Earlier Activity', tracks: earlier }
    ].filter((group) => group.tracks.length > 0);
  }, [filteredHistory]);

  return (
    <div id="history-section-container" className="flex flex-col gap-4 animate-fade-in">
      {/* Listening Analytics Dashboard Card */}
      {playbackHistory.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl liquid-glass border border-white/[0.08] shadow-lg flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={20} className="text-[var(--color-primary)]" />
              <span className="text-[13px] font-bold text-[#e4e1e7]">Listening Activity Analytics</span>
            </div>
            <span className="text-[11px] font-semibold text-[var(--color-primary)] px-2.5 py-0.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20">
              Feeds Recommendation Engine
            </span>
          </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex flex-col">
                  <span className="text-[11px] text-[#a1a1aa] font-medium">Tracks Logged</span>
                  <span className="text-[18px] font-black text-[#e4e1e7] mt-0.5">{stats.totalTracks}</span>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex flex-col">
                  <span className="text-[11px] text-[#a1a1aa] font-medium">Time Listened</span>
                  <span className="text-[18px] font-black text-[#e4e1e7] mt-0.5">{stats.totalHoursFormatted}</span>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex flex-col">
                  <span className="text-[11px] text-[#a1a1aa] font-medium">Avg Completion</span>
                  <span className="text-[18px] font-black text-emerald-400 mt-0.5">{stats.avgCompletion}%</span>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex flex-col">
                  <span className="text-[11px] text-[#a1a1aa] font-medium">Top Artist</span>
                  <span className="text-[14px] font-bold text-[var(--color-primary)] mt-1 truncate">
                    {stats.topArtist}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex flex-col">
                  <span className="text-[11px] text-[#a1a1aa] font-medium">Dominant Vibe</span>
                  <span className="text-[14px] font-bold text-[#e4e1e7] mt-1 truncate">
                    {stats.topGenre}
                  </span>
                </div>
              </div>
        </div>
      )}

      {/* Control Bar: Search & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search within history */}
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-2.5 text-[#a1a1aa]" />
          <input
            id="search-history-input"
            type="text"
            placeholder="Search playback history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-2xl liquid-glass border border-white/[0.08] text-[13px] text-[#e4e1e7] placeholder-[#71717a] focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        {playbackHistory.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="continue-listening-history-btn"
              onClick={() => onPlayHistoryQueue(playbackHistory, 0)}
              className="px-4 py-2 rounded-full bg-[var(--color-primary)] text-[#670211] text-[12px] font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer floating-btn"
            >
              <Play size={16} className="fill-current" />
              Play History
            </button>

            <button
              id="clear-history-dialog-btn"
              onClick={() => setShowClearConfirm(true)}
              className="px-3.5 py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[12px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
            >
              <Trash2 size={16} />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Clear History Confirmation Banner */}
      {showClearConfirm && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-between gap-3 text-red-200">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={20} className="text-red-400 shrink-0" />
            <span className="text-[13px] font-medium truncate">Clear all recorded playback history from this device?</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1 rounded-full text-[12px] text-white/80 hover:bg-white/10 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="confirm-clear-history-btn"
              onClick={() => {
                onClearHistory();
                setShowClearConfirm(false);
              }}
              className="px-3 py-1 rounded-full bg-red-500 text-white font-bold text-[12px] cursor-pointer hover:bg-red-600"
            >
              Confirm Clear
            </button>
          </div>
        </div>
      )}

      {/* History Track List Grouped by Day */}
      {playbackHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-10 liquid-glass rounded-3xl border border-white/[0.04] my-4">
          <div className="w-16 h-16 rounded-2xl liquid-glass text-[#a1a1aa] flex items-center justify-center mb-3">
            <History size={32} />
          </div>
          <h3 className="text-[17px] font-bold text-[#e4e1e7]">No Playback History Yet</h3>
          <p className="text-[13px] text-[#a1a1aa] max-w-sm mt-1">
            Every track you listen to will appear here and dynamically train your personalized Home recommendations.
          </p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="p-8 text-center text-[#a1a1aa] text-[13px] liquid-glass rounded-2xl">
          No songs found matching &quot;{searchQuery}&quot; in your playback history.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groupedHistory.map((group) => (
            <div key={group.label} className="flex flex-col gap-2">
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#a1a1aa] px-1">
                {group.label} ({group.tracks.length})
              </span>

              <div className="flex flex-col gap-2">
                {group.tracks.map((track, idx) => {
                  const isThisActive = currentTrack?.id === track.id;
                  const downloaded = isDownloaded(track.id);
                  const timeLabel = track.playedAt ? formatRelativeTime(track.playedAt) : `${idx + 1}`;

                  return (
                    <div
                      key={`${track.id}-${track.playedAt || idx}`}
                      id={`history-row-${track.id}`}
                      onClick={() => onPlayHistoryQueue(playbackHistory, idx)}
                      className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer border transition-all ${
                        isThisActive
                          ? 'liquid-glass/90 border-[var(--color-primary)]/40 ring-1 ring-[var(--color-primary)]/25 shadow-md'
                          : 'liquid-glass hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_8px_20px_0_rgba(0,0,0,0.25)] hover:scale-[1.01] border-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 liquid-glass-heavy relative">
                          <TrackImage
                            src={track.coverUrl}
                            videoId={track.videoId}
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                          {isThisActive && isPlaying && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Volume2 size={18} className="text-[var(--color-primary)] animate-pulse" />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <span className={`text-[14px] font-bold truncate ${isThisActive ? 'text-[var(--color-primary)]' : 'text-[#e4e1e7]'}`}>
                            {track.title}
                          </span>
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-[#a1a1aa] mt-0.5">
                            <span className="truncate max-w-[130px] font-medium text-[#d4d4d8]">{track.artist}</span>
                            <span className="text-[#52525b]">•</span>
                            <span className="text-[#71717a]">{timeLabel}</span>

                            {/* Play Duration */}
                            {typeof track.playDurationSec === 'number' && track.playDurationSec > 0 && (
                              <>
                                <span className="text-[#52525b]">•</span>
                                <span className="text-white/70 flex items-center gap-0.5 font-medium">
                                  <Clock size={12} className="text-[#a1a1aa]" />
                                  {Math.floor(track.playDurationSec / 60)}:{(track.playDurationSec % 60).toString().padStart(2, '0')} listened
                                </span>
                              </>
                            )}

                            {/* Completion Percentage Badge */}
                            {typeof track.completionPercentage === 'number' && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-0.5 ${
                                  track.completionPercentage >= 90
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                                    : track.completionPercentage >= 40
                                    ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/25'
                                    : 'bg-zinc-700/40 text-[#a1a1aa] border border-white/10'
                                }`}
                              >
                                {track.completionPercentage >= 95 ? 'Completed' : `${track.completionPercentage}%`}
                              </span>
                            )}

                            {/* Source / Playback Context Badge */}
                            {track.playbackContext?.title && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.06] text-[#d4d4d8] border border-white/[0.08] truncate max-w-[120px]">
                                {track.playbackContext.type === 'album' ? '💿 ' : track.playbackContext.type === 'playlist' ? '📑 ' : track.playbackContext.type === 'radio' ? '📻 ' : ''}
                                {track.playbackContext.title}
                              </span>
                            )}

                            {/* Play count if > 1 */}
                            {track.playCount && track.playCount > 1 && (
                              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/20">
                                {track.playCount}x plays
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                        {/* Download button */}
                        <button
                          id={`history-download-${track.id}`}
                          aria-label="Toggle download"
                          title={downloaded ? 'Downloaded offline' : 'Download for offline'}
                          onClick={() => onToggleDownload(track)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            downloaded ? 'text-emerald-400 bg-emerald-500/10' : 'text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/5'
                          }`}
                        >
                          {downloaded ? <CheckCircle2 size={16} /> : <Download size={16} />}
                        </button>

                        {/* Favorite button */}
                        <button
                          id={`history-fav-${track.id}`}
                          aria-label="Toggle favorite"
                          onClick={() => onToggleFavorite(track.id)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            track.isFavorite ? 'text-[var(--color-primary)]' : 'text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/5'
                          }`}
                        >
                          <Heart size={16} className={track.isFavorite ? 'fill-current' : ''} />
                        </button>

                        {/* Remove from history button */}
                        <button
                          id={`history-remove-${track.id}`}
                          aria-label="Remove from history"
                          title="Remove from history"
                          onClick={() => onRemoveFromHistory(track.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[#71717a] hover:text-red-400 hover:bg-white/5 transition-all cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
