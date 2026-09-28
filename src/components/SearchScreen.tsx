import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Track, MusicMix, MusicVideoItem } from '../types';
import { TRACKS } from '../data/musicData';
import { youtubeSearchService, YouTubeSearchResponse } from '../services/youtubeSearchService';
import { TrackImage } from './TrackImage';
import { networkMonitorService } from '../services/networkMonitorService';
import { offlineService } from '../services/offlineService';
import { personalizationService } from '../services/personalizationService';

export type SearchCategory = 'all' | 'songs' | 'videos' | 'artists' | 'offline';

interface SearchScreenProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onOpenVideo?: (video: MusicVideoItem) => void;
  onPlayQueue?: (tracks: Track[], startIndex?: number) => void;
  onPlayMix?: (mix: MusicMix) => void;
  initialQuery?: string;
  initialSource?: 'all' | 'youtube' | 'piped' | 'jiosaavn';
  onAddToQueue?: (track: Track) => void;
  onPlayNext?: (track: Track) => void;
  onToggleFavorite?: (trackId: string) => void;
  favoriteTrackIds?: Set<string>;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  currentTrack,
  isPlaying,
  onSelectTrack,
  onOpenVideo,
  onPlayQueue,
  initialQuery,
  onAddToQueue,
  onPlayNext,
  onToggleFavorite,
  favoriteTrackIds
}) => {
  const [inputQuery, setInputQuery] = useState(initialQuery || '');
  const [activeQuery, setActiveQuery] = useState(initialQuery || '');
  const [searchCategory, setSearchCategory] = useState<SearchCategory>('all');
  
  // YouTube Results State
  const [songs, setSongs] = useState<Track[]>([]);
  const [videos, setVideos] = useState<MusicVideoItem[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [topResult, setTopResult] = useState<Track | null>(null);
  
  // Pagination & Loading State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchToast, setSearchToast] = useState<string | null>(null);

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Offline downloads synchronization
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(() => {
    return new Set(offlineService.getAllDownloads().map((d) => d.trackId));
  });

  useEffect(() => {
    const syncDownloads = () => {
      setDownloadedIds(new Set(offlineService.getAllDownloads().map((d) => d.trackId)));
    };
    syncDownloads();
    const unsub = offlineService.subscribe(syncDownloads);
    return () => unsub();
  }, []);

  // Recent Searches
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vd_yt_recent_searches') || localStorage.getItem('vd_recent_searches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return ['Arijit Singh', 'The Weeknd', 'Taylor Swift', 'Diljit Dosanjh', 'Alan Walker'];
  });

  const saveRecentSearch = (term: string) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) return;
    try {
      personalizationService.recordSearch(cleanTerm);
    } catch {}
    setRecentSearches((prev) => {
      const updated = [cleanTerm, ...prev.filter((i) => i.toLowerCase() !== cleanTerm.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem('vd_yt_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const removeRecentSearch = (item: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((i) => i !== item);
      try {
        localStorage.setItem('vd_yt_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Execute YouTube Search Core
  const performSearch = useCallback(async (query: string, page: number = 1, append: boolean = false) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSongs([]);
      setVideos([]);
      setArtists([]);
      setTopResult(null);
      setHasMore(false);
      setIsSearching(false);
      setIsLoadingMore(false);
      return;
    }

    if (page === 1) {
      setIsSearching(true);
      setSearchError(null);
    } else {
      setIsLoadingMore(true);
    }

    // Cancel previous in-flight search
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const abortController = new AbortController();
    searchAbortRef.current = abortController;

    try {
      const result: YouTubeSearchResponse = await youtubeSearchService.search(
        trimmed,
        page,
        20,
        abortController.signal
      );

      if (abortController.signal.aborted) return;

      if (page === 1) {
        setSongs(result.songs || []);
        setVideos(result.videos || []);
        setArtists(result.artists || []);
        setTopResult(result.topResult?.item || (result.songs && result.songs[0]) || null);
      } else {
        setSongs((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const newSongs = (result.songs || []).filter((t) => !existingIds.has(t.id));
          return [...prev, ...newSongs];
        });
        setVideos((prev) => {
          const existingIds = new Set(prev.map((v) => v.id));
          const newVideos = (result.videos || []).filter((v) => !existingIds.has(v.id));
          return [...prev, ...newVideos];
        });
      }

      setCurrentPage(page);
      setHasMore(result.hasMore);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[SearchScreen] YouTube search error:', err);
        setSearchError('Could not fetch YouTube results. Please check your network connection.');
      }
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  }, []);

  // Debounced input search trigger (350ms debounce)
  useEffect(() => {
    const trimmed = inputQuery.trim();
    if (!trimmed) {
      setActiveQuery('');
      setSongs([]);
      setVideos([]);
      setArtists([]);
      setTopResult(null);
      return;
    }

    const timer = setTimeout(() => {
      setActiveQuery(trimmed);
      saveRecentSearch(trimmed);
      performSearch(trimmed, 1, false);
    }, 350);

    return () => clearTimeout(timer);
  }, [inputQuery, performSearch]);

  // Handle immediate search submit (e.g. on Enter key or Search button)
  const handleExecuteSearch = (term?: string) => {
    const queryToSearch = (term !== undefined ? term : inputQuery).trim();
    if (!queryToSearch) return;
    setInputQuery(queryToSearch);
    setActiveQuery(queryToSearch);
    saveRecentSearch(queryToSearch);
    performSearch(queryToSearch, 1, false);
  };

  // Pagination: Load More Results
  const handleLoadMore = () => {
    if (isLoadingMore || !hasMore || !activeQuery.trim()) return;
    performSearch(activeQuery, currentPage + 1, true);
  };

  // Handle Track Selection: plays via official YouTube player or standard player
  const handleTrackClick = (track: Track) => {
    if (track.videoId) {
      if (onOpenVideo) {
        onOpenVideo({
          id: track.videoId,
          videoId: track.videoId,
          title: track.title,
          artist: track.artist,
          thumbnailUrl: track.coverUrl,
          views: track.views || 'YouTube Music',
          duration: track.duration
        });
      }
    }
    onSelectTrack(track);
  };

  // Offline / Local catalog filtering
  const offlineFilteredTracks = useMemo(() => {
    if (!activeQuery.trim()) {
      return TRACKS;
    }
    const q = activeQuery.toLowerCase();
    return TRACKS.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q))
    );
  }, [activeQuery]);

  // Display filter based on category tab
  const displaySongs = useMemo(() => {
    if (searchCategory === 'offline') {
      return offlineFilteredTracks;
    }
    return songs;
  }, [searchCategory, songs, offlineFilteredTracks]);

  const displayVideos = useMemo(() => {
    return videos;
  }, [videos]);

  const CATEGORIES = [
    { id: 'all' as SearchCategory, label: 'All Results', icon: 'grid_view' },
    { id: 'songs' as SearchCategory, label: 'Songs', icon: 'music_note' },
    { id: 'videos' as SearchCategory, label: 'Music Videos', icon: 'smart_display' },
    { id: 'artists' as SearchCategory, label: 'Artists', icon: 'person' },
    { id: 'offline' as SearchCategory, label: 'Offline Vault', icon: 'cloud_off' }
  ];

  return (
    <div id="search-screen-view" className="flex flex-col w-full px-4 sm:px-6 gap-5 pb-32 max-w-4xl mx-auto animate-fade-in">
      {/* Search Input Bar with curved corners and clean dark glass */}
      <div ref={searchContainerRef} className="relative w-full pt-1 z-30">
        <div className="flex items-center w-full h-12 bg-white/[0.05] backdrop-blur-2xl rounded-2xl px-3 sm:px-4 border border-white/[0.08] shadow-lg focus-within:border-[var(--color-primary)] hover:border-white/20 transition-all duration-200">
          <span className="material-symbols-outlined text-zinc-400 text-[22px] mr-2.5 shrink-0">
            {isSearching ? 'sync' : 'search'}
          </span>
          <input
            id="search-input-field"
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleExecuteSearch();
              }
            }}
            placeholder="Search YouTube Music songs, artists, videos..."
            className="w-full bg-transparent text-[14px] text-white placeholder:text-zinc-500 focus:outline-none"
          />
          {inputQuery && (
            <button
              type="button"
              onClick={() => {
                setInputQuery('');
                setActiveQuery('');
                setSongs([]);
                setVideos([]);
                setTopResult(null);
              }}
              className="text-zinc-400 hover:text-white p-1 cursor-pointer mr-1.5"
              title="Clear Search"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}

          {/* Dedicated Search Action Button */}
          <button
            id="search-action-btn"
            type="button"
            onClick={() => handleExecuteSearch()}
            title="Search YouTube"
            className="ml-1 px-3.5 sm:px-4 py-1.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[#A855F7] hover:brightness-110 active:scale-95 text-white text-[12px] sm:text-[13px] font-bold shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer transition-all duration-200"
          >
            <span className="material-symbols-outlined text-[17px]">search</span>
            <span className="hidden xs:inline sm:inline">Search</span>
          </button>
        </div>
      </div>

      {/* Category Tabs / Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {CATEGORIES.map((cat) => {
          const isActive = searchCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSearchCategory(cat.id)}
              className={`h-9 px-3.5 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5 transition-all duration-200 cursor-pointer shrink-0 border ${
                isActive
                  ? 'bg-[var(--color-primary)] text-white border-transparent shadow-md'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08] border-white/[0.06]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Toast Feedback Notification */}
      {searchToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in duration-200 pointer-events-none">
          <div className="px-4 py-2 rounded-full bg-zinc-900/90 border border-white/10 text-white text-xs font-semibold shadow-2xl backdrop-blur-xl">
            {searchToast}
          </div>
        </div>
      )}

      {/* Error Message */}
      {searchError && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[20px] text-red-400">error</span>
          <span>{searchError}</span>
        </div>
      )}

      {/* Zero State / Recent Searches (When Query is Empty) */}
      {!activeQuery.trim() && (
        <div className="flex flex-col gap-6 pt-2">
          {recentSearches.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">
                  Recent Searches
                </span>
                <button
                  onClick={() => {
                    setRecentSearches([]);
                    localStorage.removeItem('vd_yt_recent_searches');
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    onClick={() => handleExecuteSearch(term)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white text-xs font-medium cursor-pointer transition-all group"
                  >
                    <span className="material-symbols-outlined text-[16px] text-zinc-400">history</span>
                    <span>{term}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(term);
                      }}
                      className="text-zinc-400 hover:text-white ml-0.5 p-0.5 transition-colors cursor-pointer"
                      title="Remove"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Discover suggestions */}
          <div className="flex flex-col gap-3 pt-2">
            <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">
              Trending on YouTube Music
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {['Bollywood Hits 2024', 'Lofi Hip Hop Chill', 'Global Top 50', 'Punjabi Trending', 'Acoustic Pop', 'EDM Festival'].map(
                (trend) => (
                  <button
                    key={trend}
                    onClick={() => handleExecuteSearch(trend)}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] text-left transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">trending_up</span>
                    </div>
                    <span className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate">
                      {trend}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE SEARCH RESULTS */}
      {activeQuery.trim().length > 0 && (
        <div className="flex flex-col gap-6">
          {/* Search Status & Count Header */}
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2 font-medium">
              <span>
                {isSearching ? 'Searching YouTube Music...' : `Results for "${activeQuery}"`}
              </span>
              {isSearching && (
                <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)] animate-spin">
                  sync
                </span>
              )}
            </div>
            <span>
              {searchCategory === 'offline' ? `${displaySongs.length} local songs` : `${songs.length} tracks found`}
            </span>
          </div>

          {/* Top Result Card (When in 'all' or 'songs' tab) */}
          {(searchCategory === 'all' || searchCategory === 'songs') && topResult && !isSearching && (
            <div
              onClick={() => handleTrackClick(topResult)}
              className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer group hover:border-[var(--color-primary)]/50 transition-all duration-200"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 bg-black border border-white/10 shadow-md">
                  <TrackImage
                    src={topResult.coverUrl}
                    videoId={topResult.videoId}
                    alt={topResult.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center shadow-lg">
                      <span className="material-symbols-outlined text-[24px]">play_arrow</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] font-bold uppercase tracking-wider border border-[var(--color-primary)]/30">
                      Top Result
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      {topResult.duration}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-[var(--color-primary)] transition-colors truncate">
                    {topResult.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 truncate mt-0.5">
                    {topResult.artist} • YouTube Music
                  </p>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTrackClick(topResult);
                }}
                className="self-end sm:self-center px-4 py-2 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                <span>Play Now</span>
              </button>
            </div>
          )}

          {/* Songs List */}
          {(searchCategory === 'all' || searchCategory === 'songs' || searchCategory === 'offline') && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">
                  {searchCategory === 'offline' ? 'Offline Tracks' : 'Songs'}
                </span>
              </div>

              {displaySongs.length === 0 && !isSearching ? (
                <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-zinc-500 text-xs">
                  No songs found for &quot;{activeQuery}&quot;
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {displaySongs.map((track) => {
                    const isThisActive = currentTrack?.id === track.id;
                    const isFav = favoriteTrackIds ? favoriteTrackIds.has(track.id) : track.isFavorite;
                    const isDownloaded = downloadedIds.has(track.id) || offlineService.isDownloaded(track.id);

                    return (
                      <div
                        key={track.id}
                        onClick={() => handleTrackClick(track)}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3 rounded-2xl cursor-pointer transition-all border group ${
                          isThisActive
                            ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/40 shadow-lg'
                            : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.05]'
                        }`}
                      >
                        {/* Thumbnail & Title/Artist */}
                        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                          <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden shrink-0 bg-black border border-white/10 shadow-sm">
                            <TrackImage
                              src={track.coverUrl}
                              videoId={track.videoId}
                              alt={track.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="material-symbols-outlined text-white text-[20px]">
                                play_arrow
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col min-w-0">
                            <span
                              className={`text-[13.5px] sm:text-[14px] font-bold truncate leading-snug ${
                                isThisActive ? 'text-[var(--color-primary)]' : 'text-white'
                              }`}
                            >
                              {track.title}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate mt-0.5">
                              <span className="truncate">{track.artist}</span>
                              <span>•</span>
                              <span className="font-mono text-[11px] text-zinc-500 shrink-0">
                                {track.duration}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* Play Next */}
                          {onPlayNext && (
                            <button
                              title="Play Next"
                              onClick={() => {
                                onPlayNext(track);
                                setSearchToast(`"${track.title}" set to play next`);
                                setTimeout(() => setSearchToast(null), 2000);
                              }}
                              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">playlist_play</span>
                            </button>
                          )}

                          {/* Add to Queue */}
                          {onAddToQueue && (
                            <button
                              title="Add to queue"
                              onClick={() => {
                                onAddToQueue(track);
                                setSearchToast(`"${track.title}" added to queue`);
                                setTimeout(() => setSearchToast(null), 2000);
                              }}
                              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">queue_music</span>
                            </button>
                          )}

                          {/* Favorite */}
                          {onToggleFavorite && (
                            <button
                              title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                              onClick={() => onToggleFavorite(track.id)}
                              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                                isFav ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'text-zinc-400 hover:text-white bg-white/5 hover:bg-white/15'
                              }`}
                            >
                              <span
                                className="material-symbols-outlined text-[18px]"
                                style={{ fontVariationSettings: isFav ? "'FILL' 1" : "'FILL' 0" }}
                              >
                                {isFav ? 'favorite' : 'favorite_border'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Music Videos Section (When in 'all' or 'videos' tab) */}
          {(searchCategory === 'all' || searchCategory === 'videos') && displayVideos.length > 0 && (
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">
                  YouTube Music Videos
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayVideos.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => {
                      if (onOpenVideo) onOpenVideo(video);
                    }}
                    className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] flex flex-col gap-2.5 cursor-pointer group transition-all"
                  >
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/10 shadow-md">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-2xl">
                          <span className="material-symbols-outlined text-[28px]">play_arrow</span>
                        </div>
                      </div>
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10.5px] font-mono font-bold text-white">
                        {video.duration}
                      </span>
                    </div>

                    <div className="flex flex-col min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-[var(--color-primary)] truncate transition-colors">
                        {video.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {video.artist} • {video.views}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Artists Section (When in 'all' or 'artists' tab) */}
          {(searchCategory === 'all' || searchCategory === 'artists') && artists.length > 0 && (
            <div className="flex flex-col gap-3 pt-2">
              <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">
                Artists
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {artists.map((artist) => (
                  <div
                    key={artist.id}
                    onClick={() => handleExecuteSearch(artist.name)}
                    className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] flex flex-col items-center text-center cursor-pointer group transition-all"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-2.5 bg-black border border-white/10 shadow-md group-hover:ring-2 ring-[var(--color-primary)] transition-all">
                      <img
                        src={artist.avatarUrl}
                        alt={artist.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white group-hover:text-[var(--color-primary)] truncate w-full transition-colors">
                      {artist.name}
                    </span>
                    <span className="text-[10.5px] text-zinc-400 mt-0.5">Artist</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagination: Load More Results from YouTube */}
          {hasMore && searchCategory !== 'offline' && (
            <div className="flex items-center justify-center pt-4 pb-6">
              <button
                id="load-more-youtube-btn"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="px-6 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 active:scale-95 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin text-[var(--color-primary)]">
                      sync
                    </span>
                    <span>Loading more from YouTube...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">expand_more</span>
                    <span>Load More Results</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
