import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Track, Album, Artist, Playlist, MusicMix, SearchFilterCategory, EnrichedTrackSearchResult, NormalizedSearchResult } from '../types';
import { TRACKS } from '../data/musicData';
import { searchTracks, getAudioStreamUrl } from '../utils/pipedApi';
import { TrackImage } from './TrackImage';
import { SearchSuggestions } from './SearchSuggestions';
import { searchEngine, normalizeSearchQuery } from '../services/searchEngine';
import { deduplicateTracks } from '../services/musicNormalizationService';
import { extractAlbums, extractArtists, EnrichedAlbum, EnrichedArtist } from '../services/libraryDataService';
import { AlbumDetailView } from './library/AlbumDetailView';
import { ArtistDetailView } from './library/ArtistDetailView';
import { networkMonitorService } from '../services/networkMonitorService';
import { offlineDatabaseService } from '../services/offlineDatabaseService';
import { offlineService } from '../services/offlineService';
import { personalizationService } from '../services/personalizationService';

interface SearchScreenProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
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
  onPlayQueue,
  onPlayMix,
  initialQuery,
  initialSource,
  onAddToQueue,
  onPlayNext,
  onToggleFavorite,
  favoriteTrackIds
}) => {
  const [inputQuery, setInputQuery] = useState(initialQuery || '');
  const [activeQuery, setActiveQuery] = useState(initialQuery || '');
  const [activeCategory, setActiveCategory] = useState<SearchFilterCategory>('all');
  const [pluginSource, setPluginSource] = useState<'all' | 'youtube' | 'piped' | 'jiosaavn'>(initialSource || 'all');
  const [liveOnlineResults, setLiveOnlineResults] = useState<Track[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchToast, setSearchToast] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(() => {
    return new Set(offlineService.getAllDownloads().map((d) => d.trackId));
  });
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const searchRequestIdRef = useRef(0);

  // Sync initial query and source from props
  useEffect(() => {
    if (initialQuery !== undefined && initialQuery !== '') {
      setInputQuery(initialQuery);
      setActiveQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    if (initialSource) {
      setPluginSource(initialSource);
    }
  }, [initialSource]);

  // Sync offline downloads live
  useEffect(() => {
    const syncDownloads = () => {
      setDownloadedIds(new Set(offlineService.getAllDownloads().map((d) => d.trackId)));
      const downloading = new Set<string>();
      offlineService.getAllDownloads().forEach((d) => {
        if (offlineService.isDownloading(d.trackId)) downloading.add(d.trackId);
      });
      setDownloadingIds(downloading);
    };
    syncDownloads();
    const unsub = offlineService.subscribe(syncDownloads);
    return () => unsub();
  }, []);

  const handleToggleDownload = (track: Track, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isNowDownloaded = offlineService.toggleDownload(track);
    setSearchToast(
      isNowDownloaded
        ? `"${track.title}" downloaded for offline listening`
        : `Removed "${track.title}" from offline downloads`
    );
    setTimeout(() => setSearchToast(null), 2500);
  };

  const handleExecuteSearch = (term?: string) => {
    const queryToSearch = (term !== undefined ? term : inputQuery).trim();
    if (!queryToSearch) return;
    setInputQuery(queryToSearch);
    setActiveQuery(queryToSearch);
    saveRecentSearch(queryToSearch);
    setShowSuggestions(false);
  };

  // Real-time debounced query synchronization: guarantees live searching as the user types even for a single word
  useEffect(() => {
    const trimmed = inputQuery.trim();
    if (!trimmed) {
      setActiveQuery('');
      setLiveOnlineResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setActiveQuery(trimmed);
    }, 200);
    return () => clearTimeout(timer);
  }, [inputQuery]);

  // Selected Album / Artist detail views
  const [selectedAlbum, setSelectedAlbum] = useState<EnrichedAlbum | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<EnrichedArtist | null>(null);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vd_recent_searches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const searchContainerRef = useRef<HTMLDivElement>(null);

  const allAlbums = useMemo(() => extractAlbums(TRACKS), []);
  const allArtists = useMemo(() => extractArtists(TRACKS, allAlbums), [allAlbums]);

  const saveRecentSearch = (term: string) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) return;
    personalizationService.recordSearch(cleanTerm);
    setRecentSearches((prev) => {
      const updated = [cleanTerm, ...prev.filter((i) => i.toLowerCase() !== cleanTerm.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem('vd_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const removeRecentSearch = (item: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((i) => i !== item);
      try {
        localStorage.setItem('vd_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('vd_recent_searches');
    } catch {}
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Compute Contextual Local Search Results (Typo-tolerant + Lyrics + Categorized)
  const contextualResults = useMemo(() => {
    if (!activeQuery.trim()) {
      return {
        query: '',
        hasTypoCorrection: false,
        songs: [],
        albums: [],
        artists: [],
        playlists: []
      };
    }
    return searchEngine.search(activeQuery, TRACKS);
  }, [activeQuery]);

  const [isOffline, setIsOffline] = useState<boolean>(() => networkMonitorService.isOffline() || offlineService.isOfflineOnlyMode());

  useEffect(() => {
    const unsubNet = networkMonitorService.subscribe(() => {
      setIsOffline(networkMonitorService.isOffline() || offlineService.isOfflineOnlyMode());
    });
    const unsubOff = offlineService.subscribe(() => {
      setIsOffline(networkMonitorService.isOffline() || offlineService.isOfflineOnlyMode());
    });
    return () => {
      unsubNet();
      unsubOff();
    };
  }, []);

  // Online search when active query is set, with instant local preview and fallback
  useEffect(() => {
    const trimmed = activeQuery.trim();
    if (!trimmed) {
      setLiveOnlineResults([]);
      setIsSearchingOnline(false);
      setSearchError(null);
      return;
    }

    const currentReqId = ++searchRequestIdRef.current;
    setIsSearchingOnline(true);
    setSearchError(null);

    // Provide instant local feedback so user immediately sees matches with zero waiting
    const localMatches = searchEngine.rankAndFilterTracks(TRACKS, trimmed);
    if (localMatches.length > 0) {
      setLiveOnlineResults(localMatches);
    }

    let isMounted = true;
    const abortController = new AbortController();

    // Exact millisecond network drop check: halt API calls and switch to local database
    if (networkMonitorService.isOffline() || offlineService.isOfflineOnlyMode()) {
      setIsSearchingOnline(false);
      offlineDatabaseService.searchOfflineTracks(trimmed).then((dbMatches) => {
        if (isMounted && searchRequestIdRef.current === currentReqId) {
          const ranked = searchEngine.rankAndFilterTracks([...dbMatches, ...TRACKS], trimmed);
          setLiveOnlineResults(ranked);
        }
      });
      return () => {
        isMounted = false;
        abortController.abort();
      };
    }

    const fetchOnline = async () => {
      try {
        const results = await searchTracks(trimmed, abortController.signal);
        if (isMounted && searchRequestIdRef.current === currentReqId) {
          if (results && results.length > 0) {
            // Strictly rank and filter online tracks against query
            const rankedOnline = searchEngine.rankAndFilterTracks(results, trimmed);
            if (rankedOnline.length > 0) {
              setLiveOnlineResults(rankedOnline);
            } else {
              // If ranking was strict, still display the online tracks with metadata match
              setLiveOnlineResults(
                results.map((r) => ({
                  ...r,
                  thumbnail: r.coverUrl || r.albumArt || '',
                  matchType: 'metadata_match' as const,
                  relevanceScore: 150
                }))
              );
            }
          } else {
            const dbMatches = await offlineDatabaseService.searchOfflineTracks(trimmed);
            const rankedOffline = searchEngine.rankAndFilterTracks([...dbMatches, ...TRACKS], trimmed);
            setLiveOnlineResults(rankedOffline);
          }
        }
      } catch (err: any) {
        if (isMounted && searchRequestIdRef.current === currentReqId) {
          if (err?.name !== 'AbortError') {
            const dbMatches = await offlineDatabaseService.searchOfflineTracks(trimmed);
            const rankedOffline = searchEngine.rankAndFilterTracks([...dbMatches, ...TRACKS], trimmed);
            setLiveOnlineResults(rankedOffline);
          }
        }
      } finally {
        if (isMounted && searchRequestIdRef.current === currentReqId) {
          setIsSearchingOnline(false);
        }
      }
    };

    fetchOnline();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [activeQuery, isOffline]);

  const handleTrackClick = (track: Track) => {
    onSelectTrack(track);
  };

  const handleAlbumClick = (album: Album) => {
    personalizationService.recordAlbumSelected(album.title, album.artist);
    const enriched = allAlbums.find((a) => a.id === album.id || a.title.toLowerCase() === album.title.toLowerCase());
    if (enriched) {
      setSelectedAlbum(enriched);
    } else {
      // Find tracks
      const matchingTracks = TRACKS.filter((t) => t.album?.toLowerCase() === album.title.toLowerCase());
      setSelectedAlbum({
        ...album,
        tracks: matchingTracks,
        totalSec: matchingTracks.reduce((acc, t) => acc + (t.durationSec || 200), 0),
        totalDuration: `${matchingTracks.length * 3} min`
      });
    }
  };

  const handleArtistClick = (artist: Artist) => {
    personalizationService.recordArtistSelected(artist.name);
    const enriched = allArtists.find((a) => a.id === artist.id || a.name.toLowerCase() === artist.name.toLowerCase());
    if (enriched) {
      setSelectedArtist(enriched);
    } else {
      const artTracks = TRACKS.filter((t) => t.artist.toLowerCase().includes(artist.name.toLowerCase()));
      setSelectedArtist({
        ...artist,
        tracks: artTracks,
        albums: []
      });
    }
  };

  const handlePlaylistClick = (item: Playlist | MusicMix) => {
    if ('badge' in item && onPlayMix) {
      personalizationService.recordPlaylistSelected(item.id, []);
      onPlayMix(item as MusicMix);
    } else if ('tracks' in item && (item as Playlist).tracks.length > 0) {
      const pl = item as Playlist;
      personalizationService.recordPlaylistSelected(pl.name || pl.id, pl.tracks);
      if (onPlayQueue) {
        onPlayQueue(pl.tracks, 0);
      } else {
        onSelectTrack(pl.tracks[0]);
      }
    }
  };

  // If viewing detailed album
  if (selectedAlbum) {
    return (
      <AlbumDetailView
        album={selectedAlbum}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onBack={() => setSelectedAlbum(null)}
        onSelectTrack={onSelectTrack}
        onPlayAlbum={onPlayQueue || ((tr, idx) => onSelectTrack(tr[idx || 0]))}
        onTogglePlay={() => {}}
        onToggleFavorite={() => {}}
        isDownloaded={() => false}
        onToggleDownload={() => {}}
      />
    );
  }

  // If viewing detailed artist
  if (selectedArtist) {
    return (
      <ArtistDetailView
        artist={selectedArtist}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        isSubscribed={false}
        onBack={() => setSelectedArtist(null)}
        onSelectTrack={onSelectTrack}
        onPlayArtistTracks={onPlayQueue || ((tr, idx) => onSelectTrack(tr[idx || 0]))}
        onTogglePlay={() => {}}
        onToggleFavorite={() => {}}
        onToggleSubscription={() => {}}
        onSelectAlbum={handleAlbumClick}
        isDownloaded={() => false}
        onToggleDownload={() => {}}
      />
    );
  }

  // Combined and strictly ranked song list (local matches + online matches deduplicated)
  const combinedSongs: NormalizedSearchResult[] = useMemo(() => {
    if (!activeQuery.trim()) return [];

    const allCandidateTracks: Track[] = [...contextualResults.songs, ...liveOnlineResults];
    const ranked = searchEngine.rankAndFilterTracks(allCandidateTracks, activeQuery.trim());
    return ranked;
  }, [activeQuery, contextualResults.songs, liveOnlineResults]);

  // Determine unified top result across all categories
  const topResult = useMemo(() => {
    if (!activeQuery.trim()) return undefined;

    const normQuery = normalizeSearchQuery(activeQuery);
    const topArtist = contextualResults.artists[0];
    const topSong = combinedSongs[0];
    const topAlbum = contextualResults.albums[0];

    // Priority 1: Exact artist match (e.g. "AP Dhillon", "Alan Walker")
    if (topArtist && normalizeSearchQuery(topArtist.name) === normQuery) {
      return { type: 'artist' as const, item: topArtist };
    }
    // Priority 2: High-confidence song match (exact or prefix title match)
    if (topSong && (topSong.relevanceScore || 0) >= 200) {
      return { type: 'song' as const, item: topSong };
    }
    // Priority 3: Artist prefix match
    if (topArtist && normalizeSearchQuery(topArtist.name).startsWith(normQuery)) {
      return { type: 'artist' as const, item: topArtist };
    }
    // Priority 4: Album exact match
    if (topAlbum && normalizeSearchQuery(topAlbum.title) === normQuery) {
      return { type: 'album' as const, item: topAlbum };
    }
    // Priority 5: Fallback to top song if valid title or metadata match
    if (topSong && (topSong.relevanceScore || 0) >= 50 && topSong.matchType !== 'lyric_match') {
      return { type: 'song' as const, item: topSong };
    }
    return contextualResults.topResult;
  }, [activeQuery, contextualResults.artists, contextualResults.albums, contextualResults.topResult, combinedSongs]);

  // Filter songs based on active engine source (all, youtube, piped, jiosaavn, local)
  const sourceFilteredSongs: NormalizedSearchResult[] = useMemo(() => {
    if (pluginSource === 'all') return combinedSongs;

    if (pluginSource === 'local') {
      try {
        const rawLocal = localStorage.getItem('bloomee_device_audio_files');
        const localList: Track[] = rawLocal ? JSON.parse(rawLocal) : [];
        const offlineList: Track[] = offlineDatabaseService.getOfflineTracksSync();
        const combined = [...localList, ...offlineList];
        if (activeQuery.trim()) {
          const q = activeQuery.toLowerCase();
          return combined.filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.artist.toLowerCase().includes(q) ||
              t.album?.toLowerCase().includes(q)
          ) as NormalizedSearchResult[];
        }
        return combined as NormalizedSearchResult[];
      } catch {
        return [];
      }
    }

    if (pluginSource === 'youtube') {
      return combinedSongs.filter(
        (t) => !t.id.startsWith('local-') && !t.id.startsWith('piped-') && (t.videoId || t.source === 'youtube')
      );
    }

    if (pluginSource === 'piped') {
      return combinedSongs.filter(
        (t) => t.id.startsWith('piped-') || t.source === 'piped' || t.quality?.includes('High Quality')
      );
    }

    if (pluginSource === 'jiosaavn') {
      return combinedSongs.filter(
        (t) =>
          t.source === 'jiosaavn' ||
          t.genre?.toLowerCase().includes('bollywood') ||
          t.genre?.toLowerCase().includes('punjabi') ||
          t.genre?.toLowerCase().includes('hindi') ||
          t.genre?.toLowerCase().includes('romance') ||
          t.artist.toLowerCase().includes('shikhar') ||
          t.artist.toLowerCase().includes('darshan') ||
          t.artist.toLowerCase().includes('arijit') ||
          t.artist.toLowerCase().includes('asees') ||
          t.title.toLowerCase().includes('sauda') ||
          t.title.toLowerCase().includes('preet')
      );
    }

    return combinedSongs;
  }, [combinedSongs, pluginSource, activeQuery]);

  // Songs to display in the "ALL" tab's Songs section (strictly exclude Top Result song to prevent duplicates!)
  const songsForDisplay = useMemo(() => {
    if (!topResult || topResult.type !== 'song') {
      return sourceFilteredSongs;
    }
    const topSongId = (topResult.item as Track).id;
    const topSongVideoId = (topResult.item as Track).videoId;
    return sourceFilteredSongs.filter(
      (s) => s.id !== topSongId && (!topSongVideoId || s.videoId !== topSongVideoId)
    );
  }, [sourceFilteredSongs, topResult]);

  const getSourceBadge = (track: Track) => {
    if (track.id.startsWith('local-') || (track as any).isLocal) {
      return { label: 'Local File', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    }
    if (downloadedIds.has(track.id) || offlineService.isDownloaded(track.id)) {
      return { label: 'Downloaded', color: 'bg-teal-500/15 text-teal-300 border-teal-500/30' };
    }
    if (track.id.startsWith('piped-') || track.source === 'piped') {
      return { label: 'Piped', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    }
    if (
      track.source === 'jiosaavn' ||
      track.genre?.toLowerCase().includes('bollywood') ||
      track.genre?.toLowerCase().includes('punjabi') ||
      track.genre?.toLowerCase().includes('hindi') ||
      track.artist.toLowerCase().includes('darshan') ||
      track.artist.toLowerCase().includes('arijit') ||
      track.artist.toLowerCase().includes('shikhar')
    ) {
      return { label: 'JioSaavn', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
    }
    return { label: 'YouTube Music', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
  };

  const totalResultsCount =
    (topResult ? 1 : 0) +
    songsForDisplay.length +
    contextualResults.albums.length +
    contextualResults.artists.length +
    contextualResults.playlists.length;

  // Debugging console logs per Requirement 15
  useEffect(() => {
    if (!activeQuery.trim()) return;

    const normQuery = normalizeSearchQuery(activeQuery);
    console.log(`[Search] query: "${activeQuery}"`);
    console.log(`[Search] normalized query: "${normQuery}"`);
    console.log(`[Search] raw results: ${contextualResults.songs.length + liveOnlineResults.length}`);
    console.log(`[Search] normalized results: ${combinedSongs.length}`);
    console.log(`[Search] ranked results: ${combinedSongs.length}`);
    combinedSongs.forEach((s) => {
      console.log(`  title: "${s.title}", artist: "${s.artist}", matchType: "${s.matchType}", relevanceScore: ${s.relevanceScore}`);
    });
    console.log(
      `[Search] top result:`,
      topResult ? `${topResult.type}: ${'title' in topResult.item ? topResult.item.title : topResult.item.name}` : null
    );
    console.log(`[Search] filtered results: ${songsForDisplay.length}`);
    console.log(`[Search] final Songs:`, songsForDisplay.map((s) => s.title));
    console.log(`[Search] final Albums:`, contextualResults.albums.map((a) => a.title));
    console.log(`[Search] final Artists:`, contextualResults.artists.map((a) => a.name));
  }, [activeQuery, combinedSongs, topResult, songsForDisplay, contextualResults, liveOnlineResults]);

  const renderSongRow = (track: EnrichedTrackSearchResult) => {
    const isThisTrackActive = currentTrack?.id === track.id;
    const isLoadingThis = loadingTrackId === track.id;
    const isDownloaded = downloadedIds.has(track.id) || offlineService.isDownloaded(track.id);
    const isDownloading = downloadingIds.has(track.id) || offlineService.isDownloading(track.id);
    const isFav = favoriteTrackIds ? favoriteTrackIds.has(track.id) : (track.isFavorite || false);
    const sourceBadge = getSourceBadge(track);

    return (
      <div
        key={track.id}
        onClick={() => handleTrackClick(track)}
        className={`flex flex-col p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-all border group ${
          isThisTrackActive
            ? 'bg-red-500/15 border-red-500/40 shadow-lg'
            : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.05]'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-zinc-800 border border-white/10">
              <TrackImage
                src={track.coverUrl}
                videoId={track.videoId}
                alt={track.title}
                className="w-full h-full object-cover"
              />
              {isThisTrackActive && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="material-symbols-outlined floating-icon text-red-500 text-[22px] animate-pulse">
                    {isPlaying ? 'volume_up' : 'pause'}
                  </span>
                </div>
              )}
              {isLoadingThis && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="material-symbols-outlined floating-icon text-red-500 text-[20px] animate-spin">
                    progress_activity
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className={`text-[14px] font-bold truncate ${isThisTrackActive ? 'text-red-400' : 'text-white'}`}>
                {track.title}
              </span>
              <div className="flex items-center gap-1.5 text-[12px] text-zinc-400 truncate mt-0.5">
                <span className="truncate">{track.artist}</span>
                {track.album && <span>•</span>}
                <span className="truncate">{track.album}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Source Engine Badge */}
            <span className={`hidden sm:inline-flex text-[9px] font-semibold px-2 py-0.5 rounded-full border ${sourceBadge.color}`}>
              {sourceBadge.label}
            </span>

            {/* Quality badge */}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
              {track.quality?.includes('320') ? '320k' : track.quality?.includes('FLAC') ? 'FLAC' : 'Hi-Res'}
            </span>

            <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">{track.duration}</span>

            {/* 1-Click Download Button */}
            <button
              id={`search-download-btn-${track.id}`}
              title={isDownloaded ? 'Downloaded in offline vault' : 'Download for offline listening'}
              onClick={(e) => handleToggleDownload(track, e)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 active:scale-90 cursor-pointer ${
                isDownloaded
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : isDownloading
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white'
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${isDownloading ? 'animate-spin' : ''}`}>
                {isDownloading ? 'progress_activity' : isDownloaded ? 'check_circle' : 'download'}
              </span>
            </button>

            {/* Play Next Button */}
            {onPlayNext && (
              <button
                title="Play Next"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayNext(track);
                  setSearchToast(`"${track.title}" set to play next`);
                  setTimeout(() => setSearchToast(null), 2000);
                }}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 active:scale-90 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  playlist_play
                </span>
              </button>
            )}

            {/* Quick Add to Queue Button */}
            {onAddToQueue && (
              <button
                title="Add to queue"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToQueue(track);
                  setSearchToast(`Added "${track.title}" to Up Next`);
                  setTimeout(() => setSearchToast(null), 2000);
                }}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 active:scale-90 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  playlist_add
                </span>
              </button>
            )}

            {/* Favorite toggle */}
            {onToggleFavorite && (
              <button
                title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(track.id);
                }}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-rose-400 flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 active:scale-90 cursor-pointer"
              >
                <span 
                  className="material-symbols-outlined text-[18px] text-[var(--color-primary)]"
                  style={{ fontVariationSettings: isFav ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {isFav ? 'favorite' : 'favorite_border'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Lyric Snippet Highlight if matched in lyrics */}
        {track.lyricMatch && (
          <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center gap-2 text-[11px] text-amber-300/90 font-medium">
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider shrink-0">
              Matched in Lyrics
            </span>
            <span className="italic truncate">
              &quot;{track.lyricMatch.matchedLine}&quot;
            </span>
          </div>
        )}
      </div>
    );
  };

  // Related search phrases for the search word
  const relatedSearchPhrases = useMemo(() => {
    const q = activeQuery.trim();
    if (!q) return [];
    return [
      `${q} song`,
      `${q} remix`,
      `${q} lofi`,
      `${q} lyrics`,
      `${q} slowed & reverb`,
      `${q} acoustic`,
      `${q} hits`
    ];
  }, [activeQuery]);

  // Songs specifically related to the search word
  const relatedSongsForSearchWord = useMemo(() => {
    const q = activeQuery.trim();
    if (!q) return [];
    const norm = normalizeSearchQuery(q);
    const combined = [...liveOnlineResults, ...contextualResults.songs, ...TRACKS];
    const unique = deduplicateTracks(combined);
    return unique
      .filter((t) => {
        const titleNorm = normalizeSearchQuery(t.title);
        const artistNorm = normalizeSearchQuery(t.artist);
        const genreNorm = normalizeSearchQuery(t.genre || '');
        return (
          titleNorm.includes(norm) ||
          artistNorm.includes(norm) ||
          genreNorm.includes(norm) ||
          titleNorm.split(' ').some((w) => w.startsWith(norm)) ||
          artistNorm.split(' ').some((w) => w.startsWith(norm))
        );
      })
      .slice(0, 6);
  }, [activeQuery, liveOnlineResults, contextualResults.songs]);

  return (
    <div id="search-screen-view" className="flex flex-col w-full px-4 sm:px-6 gap-4 pb-28 max-w-4xl mx-auto animate-fade-in">
      {/* Search Input Bar */}
      <div ref={searchContainerRef} className="relative w-full mt-2 z-30">
        <div className="flex items-center w-full h-12 bg-white/[0.06] backdrop-blur-2xl rounded-2xl px-3 sm:px-4 border border-white/[0.08] shadow-lg focus-within:border-red-500 hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5">
          <button
            type="button"
            onClick={() => handleExecuteSearch()}
            className="material-symbols-outlined floating-icon text-zinc-400 hover:text-red-400 text-[22px] mr-2.5 cursor-pointer transition-colors"
          >
            {isSearchingOnline ? 'sync' : 'search'}
          </button>
          <input
            id="search-input-field"
            type="text"
            value={inputQuery}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setInputQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleExecuteSearch();
              } else if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
            placeholder="Search songs, artists, albums, or lyrics (e.g. 'love storiyan')..."
            className="w-full bg-transparent text-[14px] text-white placeholder:text-zinc-500 focus:outline-none"
          />
          {inputQuery && (
            <button
              type="button"
              onClick={() => {
                setInputQuery('');
                setActiveQuery('');
                setLiveOnlineResults([]);
                setShowSuggestions(true);
              }}
              className="text-zinc-400 hover:text-white p-1 cursor-pointer mr-1"
            >
              <span className="material-symbols-outlined floating-icon text-[18px]">close</span>
            </button>
          )}

          {/* Dedicated Search Action Button with curved corners and floating lift */}
          <button
            id="search-action-btn"
            type="button"
            onClick={() => handleExecuteSearch()}
            title="Search"
            className="ml-1 px-3 sm:px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#FE385E] to-[#FF4365] hover:brightness-110 active:scale-95 text-white text-[12px] sm:text-[13px] font-bold shadow-md shadow-rose-950/40 flex items-center gap-1.5 shrink-0 cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
          >
            <span className="material-symbols-outlined text-[17px]">search</span>
            <span className="hidden xs:inline sm:inline">Search</span>
          </button>
        </div>

        {/* Live Search Suggestions Dropdown */}
        <div className="absolute top-full left-0 right-0 mt-2 z-40">
          <SearchSuggestions
            query={inputQuery}
            isVisible={showSuggestions}
            onSelectSong={(track) => {
              handleTrackClick(track);
              saveRecentSearch(track.title);
              setShowSuggestions(false);
            }}
            onSelectArtist={(artist) => {
              handleArtistClick(artist);
              saveRecentSearch(artist.name);
              setShowSuggestions(false);
            }}
            onSelectAlbum={(album) => {
              handleAlbumClick(album);
              saveRecentSearch(album.title);
              setShowSuggestions(false);
            }}
            onSelectPlaylist={(playlist) => {
              handlePlaylistClick(playlist);
              saveRecentSearch('title' in playlist ? playlist.title : playlist.name);
              setShowSuggestions(false);
            }}
            onSelectQuery={(q) => {
              setInputQuery(q);
              setActiveQuery(q);
              saveRecentSearch(q);
              setShowSuggestions(false);
            }}
            onInsertQuery={(q) => {
              setInputQuery(q);
              setShowSuggestions(true);
            }}
            recentSearches={recentSearches}
            onRemoveRecentSearch={removeRecentSearch}
            onClearRecentSearches={clearRecentSearches}
          />
        </div>
      </div>

      {/* Typo Correction Banner */}
      {contextualResults.hasTypoCorrection && contextualResults.correctedQuery && (
        <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2 text-[13px] text-zinc-300">
            <span className="material-symbols-outlined floating-icon text-[18px] text-amber-400">
              spellcheck
            </span>
            <span>
              Showing results for{' '}
              <strong className="text-white font-bold underline cursor-pointer" onClick={() => {
                setInputQuery(contextualResults.correctedQuery!);
                setActiveQuery(contextualResults.correctedQuery!);
              }}>
                {contextualResults.correctedQuery}
              </strong>
            </span>
          </div>
          <button
            onClick={() => {
              setInputQuery(activeQuery);
            }}
            className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
          >
            Search instead for &quot;{activeQuery}&quot;
          </button>
        </div>
      )}

      {/* Error Banner */}
      {searchError && (
        <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-fade-in">
          <span className="material-symbols-outlined floating-icon text-[18px] text-red-400">
            error
          </span>
          <span className="text-[13px] text-red-200">
            {searchError}
          </span>
        </div>
      )}

      {/* Results Header Info */}
      {activeQuery.trim().length > 0 && (
        <div className="flex items-center justify-between text-[12px] text-zinc-400 px-0.5">
          <div className="flex items-center gap-2 font-medium">
            <span>
              {isSearchingOnline ? 'Searching catalog & YouTube...' : `Results for "${activeQuery}"`}
            </span>
            {isSearchingOnline && (
              <span className="material-symbols-outlined floating-icon text-[16px] text-red-500 animate-spin">
                sync
              </span>
            )}
          </div>
          <span>{totalResultsCount} items</span>
        </div>
      )}

      {/* Related Suggestions & Songs for Search Word */}
      {activeQuery.trim().length > 0 && (
        <div className="flex flex-col gap-3 p-3.5 sm:p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FE385E] text-[18px]">auto_awesome</span>
              <span className="text-[13px] font-bold text-white">
                Related to &ldquo;{activeQuery}&rdquo;
              </span>
            </div>
            <span className="text-[11px] text-zinc-400">Suggestions</span>
          </div>

          {/* Related search query chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {relatedSearchPhrases.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => handleExecuteSearch(phrase)}
                className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-zinc-300 hover:text-white text-[12px] font-medium border border-white/[0.08] transition-all duration-200 shrink-0 cursor-pointer flex items-center gap-1.5 hover:-translate-y-0.5 active:scale-95"
              >
                <span className="material-symbols-outlined text-[14px] text-zinc-400">search</span>
                <span>{phrase}</span>
              </button>
            ))}
          </div>

          {/* Related song cards for the search word */}
          {relatedSongsForSearchWord.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-0.5">
              {relatedSongsForSearchWord.slice(0, 4).map((track) => (
                <div
                  key={`rel-word-${track.id}`}
                  onClick={() => handleTrackClick(track)}
                  className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.04] transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-zinc-800">
                      <img
                        src={track.coverUrl || track.albumArt || '/streamzy_logo.jpg'}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="material-symbols-outlined text-white text-[20px]">play_arrow</span>
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-semibold text-white truncate group-hover:text-rose-300 transition-colors">
                        {track.title}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate">
                        {track.artist}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrackClick(track);
                    }}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-[#FE385E] text-zinc-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
                    title="Play track"
                  >
                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Zero State (When query is empty) */}
      {!activeQuery.trim() && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-400">
            <span className="material-symbols-outlined floating-icon text-[32px]">travel_explore</span>
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="text-[16px] font-bold text-white">Contextual Music Search</h3>
            <p className="text-[13px] text-zinc-400">
              Find songs by lyrics (e.g. &quot;love storiyan&quot;), search artists, albums, or discover fresh tracks with typo-tolerant matching.
            </p>
          </div>

          {/* Quick Popular Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mt-2">
            {['Kesariya', 'Arijit Singh', 'Sidhu Moosewala', 'Brown Munde', 'Starboy', 'Dil ke nagar'].map((chip) => (
              <button
                key={chip}
                onClick={() => {
                  setInputQuery(chip);
                  setActiveQuery(chip);
                  saveRecentSearch(chip);
                }}
                className="px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 text-[12px] font-medium border border-white/10 transition-colors cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB: ALL (Bento Overview with Top Result, Songs, Artists, Albums, Playlists) */}
      {activeQuery.trim().length > 0 && activeCategory === 'all' && (
        <div className="space-y-6">
          {totalResultsCount === 0 && !isSearchingOnline && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-400">
                <span className="material-symbols-outlined floating-icon text-[32px]">search_off</span>
              </div>
              <div className="max-w-md space-y-1.5">
                <h3 className="text-[16px] font-bold text-white">No results found</h3>
                <p className="text-[13px] text-zinc-400">
                  We couldn&apos;t find anything matching &quot;{activeQuery}&quot;. Try adjusting your spelling or using fewer keywords.
                </p>
              </div>
            </div>
          )}
          {/* Top Result Card */}
          {topResult && (
            <div className="p-4 rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className={`relative overflow-hidden shrink-0 border border-white/10 ${
                  topResult.type === 'artist' ? 'w-20 h-20 rounded-full' : 'w-20 h-20 rounded-2xl'
                }`}>
                  <img
                    src={'coverUrl' in topResult.item ? topResult.item.coverUrl : (topResult.item as Artist).avatarUrl}
                    alt={'name' in topResult.item ? topResult.item.name : topResult.item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-[#FE385E] text-[10px] font-bold text-white uppercase tracking-wider">
                      Top Result
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-400 capitalize">
                      {topResult.type}
                    </span>
                  </div>
                  <h4 className="text-[18px] font-black text-white truncate">
                    {'name' in topResult.item ? topResult.item.name : topResult.item.title}
                  </h4>
                  <p className="text-[13px] text-zinc-400 truncate mt-0.5">
                    {topResult.type === 'artist'
                      ? `${(topResult.item as Artist).subscribers || 'Artist'} • ${(topResult.item as Artist).trackCount} tracks`
                      : topResult.type === 'album'
                      ? `${(topResult.item as Album).artist} • ${(topResult.item as Album).year || 'Album'}`
                      : `${(topResult.item as Track).artist} • ${(topResult.item as Track).album}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end shrink-0">
                <button
                  onClick={() => {
                    if (topResult?.type === 'artist') {
                      handleArtistClick(topResult.item as Artist);
                    } else if (topResult?.type === 'album') {
                      handleAlbumClick(topResult.item as Album);
                    } else {
                      handleTrackClick(topResult!.item as Track);
                    }
                  }}
                  className="px-5 py-2.5 rounded-full bg-[#FE385E] text-white font-bold text-[13px] hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2 cursor-pointer justify-center"
                >
                  <span className="material-symbols-outlined floating-icon text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    play_arrow
                  </span>
                  <span>Play</span>
                </button>

                {topResult.type === 'song' && (
                  <>
                    <button
                      title={
                        downloadedIds.has((topResult.item as Track).id)
                          ? 'Downloaded to offline vault'
                          : 'Download for offline listening'
                      }
                      onClick={(e) => handleToggleDownload(topResult.item as Track, e)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                        downloadedIds.has((topResult.item as Track).id)
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : downloadingIds.has((topResult.item as Track).id)
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[20px] ${downloadingIds.has((topResult.item as Track).id) ? 'animate-spin' : ''}`}>
                        {downloadingIds.has((topResult.item as Track).id)
                          ? 'progress_activity'
                          : downloadedIds.has((topResult.item as Track).id)
                          ? 'check_circle'
                          : 'download'}
                      </span>
                    </button>

                    {onPlayNext && (
                      <button
                        title="Play Next"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayNext(topResult.item as Track);
                          setSearchToast(`"${(topResult.item as Track).title}" set to play next`);
                          setTimeout(() => setSearchToast(null), 2000);
                        }}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          playlist_play
                        </span>
                      </button>
                    )}

                    {onAddToQueue && (
                      <button
                        title="Add to queue"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToQueue(topResult.item as Track);
                          setSearchToast(`Added "${(topResult.item as Track).title}" to queue`);
                          setTimeout(() => setSearchToast(null), 2000);
                        }}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          playlist_add
                        </span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Section: Songs */}
          {songsForDisplay.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-white">Songs</h3>
                {songsForDisplay.length > 4 && (
                  <button
                    onClick={() => setActiveCategory('songs')}
                    className="text-[12px] font-semibold text-red-400 hover:text-red-300"
                  >
                    See all ({songsForDisplay.length})
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {songsForDisplay.slice(0, 5).map((track) => renderSongRow(track))}
              </div>
            </div>
          )}

          {/* Section: Artists Carousel */}
          {contextualResults.artists.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-white">Artists</h3>
                {contextualResults.artists.length > 3 && (
                  <button
                    onClick={() => setActiveCategory('artists')}
                    className="text-[12px] font-semibold text-red-400 hover:text-red-300"
                  >
                    See all
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {contextualResults.artists.slice(0, 4).map((artist) => (
                  <div
                    key={artist.id}
                    onClick={() => handleArtistClick(artist)}
                    className="flex flex-col items-center p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] cursor-pointer transition-all group"
                  >
                    <div className="w-20 h-20 rounded-full overflow-hidden mb-2.5 border border-white/10 group-hover:scale-105 transition-transform">
                      <img src={artist.avatarUrl} alt={artist.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[13px] font-bold text-white truncate w-full text-center">
                      {artist.name}
                    </span>
                    <span className="text-[11px] text-zinc-400 truncate w-full text-center mt-0.5">
                      {artist.subscribers || `${artist.trackCount} songs`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Albums Grid */}
          {contextualResults.albums.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-white">Albums</h3>
                {contextualResults.albums.length > 3 && (
                  <button
                    onClick={() => setActiveCategory('albums')}
                    className="text-[12px] font-semibold text-red-400 hover:text-red-300"
                  >
                    See all
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {contextualResults.albums.slice(0, 4).map((album) => (
                  <div
                    key={album.id}
                    onClick={() => handleAlbumClick(album)}
                    className="flex flex-col p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] cursor-pointer transition-all group"
                  >
                    <div className="w-full aspect-square rounded-xl overflow-hidden mb-2.5 border border-white/10 group-hover:scale-105 transition-transform">
                      <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[13px] font-bold text-white truncate">
                      {album.title}
                    </span>
                    <span className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {album.artist} • {album.year}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Playlists & Mixes */}
          {contextualResults.playlists.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[16px] font-bold text-white">Playlists & Curated Mixes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {contextualResults.playlists.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handlePlaylistClick(item)}
                    className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] cursor-pointer transition-all"
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-zinc-800">
                      {'coverGrid' in item ? (
                        <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                          {(item as MusicMix).coverGrid.map((img, i) => (
                            <img key={i} src={img} alt="" className="w-full h-full object-cover" />
                          ))}
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-red-950/40 text-red-400">
                          <span className="material-symbols-outlined floating-icon text-[24px]">queue_music</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[14px] font-bold text-white truncate">
                        {'title' in item ? item.title : item.name}
                      </span>
                      <span className="text-[12px] text-zinc-400 truncate mt-0.5">
                        {'subtitle' in item ? item.subtitle : `${(item as Playlist).tracks?.length || 0} tracks`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: SONGS ONLY */}
      {activeQuery.trim().length > 0 && activeCategory === 'songs' && (
        <div className="space-y-2">
          {sourceFilteredSongs.map((track) => renderSongRow(track))}
          {sourceFilteredSongs.length === 0 && (
            <div className="py-12 text-center text-zinc-400 text-sm">
              No matching songs found for &quot;{activeQuery}&quot;
            </div>
          )}
        </div>
      )}

      {/* TAB: ALBUMS ONLY */}
      {activeQuery.trim().length > 0 && activeCategory === 'albums' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {contextualResults.albums.map((album) => (
            <div
              key={album.id}
              onClick={() => handleAlbumClick(album)}
              className="flex flex-col p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] cursor-pointer transition-all group"
            >
              <div className="w-full aspect-square rounded-xl overflow-hidden mb-3 border border-white/10 group-hover:scale-105 transition-transform">
                <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
              </div>
              <span className="text-[14px] font-bold text-white truncate">
                {album.title}
              </span>
              <span className="text-[12px] text-zinc-400 truncate mt-0.5">
                {album.artist} • {album.year}
              </span>
            </div>
          ))}
          {contextualResults.albums.length === 0 && (
            <div className="col-span-full py-12 text-center text-zinc-400 text-sm">
              No albums matched &quot;{activeQuery}&quot;
            </div>
          )}
        </div>
      )}

      {/* TAB: ARTISTS ONLY */}
      {activeQuery.trim().length > 0 && activeCategory === 'artists' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {contextualResults.artists.map((artist) => (
            <div
              key={artist.id}
              onClick={() => handleArtistClick(artist)}
              className="flex flex-col items-center p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] cursor-pointer transition-all group text-center"
            >
              <div className="w-24 h-24 rounded-full overflow-hidden mb-3 border border-white/10 group-hover:scale-105 transition-transform">
                <img src={artist.avatarUrl} alt={artist.name} className="w-full h-full object-cover" />
              </div>
              <span className="text-[14px] font-bold text-white truncate w-full">
                {artist.name}
              </span>
              <span className="text-[12px] text-zinc-400 truncate w-full mt-0.5">
                {artist.subscribers || `${artist.trackCount} tracks`}
              </span>
              {artist.genres && artist.genres.length > 0 && (
                <span className="text-[10px] font-medium text-red-400 mt-1 uppercase tracking-wider">
                  {artist.genres[0]}
                </span>
              )}
            </div>
          ))}
          {contextualResults.artists.length === 0 && (
            <div className="col-span-full py-12 text-center text-zinc-400 text-sm">
              No artists matched &quot;{activeQuery}&quot;
            </div>
          )}
        </div>
      )}

      {/* TAB: PLAYLISTS ONLY */}
      {activeQuery.trim().length > 0 && activeCategory === 'playlists' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {contextualResults.playlists.map((item) => (
            <div
              key={item.id}
              onClick={() => handlePlaylistClick(item)}
              className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] cursor-pointer transition-all"
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-zinc-800">
                {'coverGrid' in item ? (
                  <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                    {(item as MusicMix).coverGrid.map((img, i) => (
                      <img key={i} src={img} alt="" className="w-full h-full object-cover" />
                    ))}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-red-950/40 text-red-400">
                    <span className="material-symbols-outlined floating-icon text-[28px]">queue_music</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] font-bold text-white truncate">
                  {'title' in item ? item.title : item.name}
                </span>
                <span className="text-[12px] text-zinc-400 truncate mt-0.5">
                  {'subtitle' in item ? item.subtitle : `${(item as Playlist).tracks?.length || 0} tracks`}
                </span>
              </div>
            </div>
          ))}
          {contextualResults.playlists.length === 0 && (
            <div className="col-span-full py-12 text-center text-zinc-400 text-sm">
              No playlists matched &quot;{activeQuery}&quot;
            </div>
          )}
        </div>
      )}

      {/* Dynamic Action & Download Feedback Toast */}
      {searchToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 w-full max-w-sm animate-fade-in">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-black/90 backdrop-blur-xl border border-white/20 shadow-2xl text-white text-xs font-semibold">
            <span className="material-symbols-outlined text-emerald-400 text-[18px]">
              check_circle
            </span>
            <span className="truncate">{searchToast}</span>
          </div>
        </div>
      )}
    </div>
  );
};
