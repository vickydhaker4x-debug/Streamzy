import React, { useState, useEffect, useMemo } from 'react';
import { Track, SettingsState, Playlist } from '../types';
import { sanitizeTrackForPersistence } from '../services/musicNormalizationService';
import { TrackImage } from './TrackImage';
import { extractAlbums, extractArtists, EnrichedAlbum, EnrichedArtist } from '../services/libraryDataService';
import { offlineService } from '../services/offlineService';
import { subscriptionService } from '../services/subscriptionService';
import { AlbumDetailView } from './library/AlbumDetailView';
import { ArtistDetailView } from './library/ArtistDetailView';
import { LikedSongsView } from './library/LikedSongsView';
import { HistorySection } from './library/HistorySection';
import { OfflineDownloadsSection } from './library/OfflineDownloadsSection';
import { SubscriptionsSection } from './library/SubscriptionsSection';
import { realtimeSyncService } from '../services/realtimeSyncService';

interface LibraryScreenProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  settings: SettingsState;
  playbackHistory: Track[];
  onClearHistory: () => void;
  onRemoveFromHistory: (trackId: string) => void;
  onSelectTrack: (track: Track) => void;
  onPlayQueue?: (tracks: Track[], startIndex?: number) => void;
  onTogglePlay: () => void;
  onToggleFavorite: (trackId: string) => void;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  settings: _settings,
  playbackHistory,
  onClearHistory,
  onRemoveFromHistory,
  onSelectTrack,
  onPlayQueue,
  onTogglePlay: _onTogglePlay,
  onToggleFavorite
}) => {
  // Navigation Tabs: playlists, liked, albums, artists, subscriptions, history, downloads
  const [activeTab, setActiveTab] = useState<
    'playlists' | 'liked' | 'albums' | 'artists' | 'subscriptions' | 'history' | 'downloads'
  >('playlists');

  // Subscriptions & Downloads live update tick
  const [, setServiceTick] = useState(0);

  useEffect(() => {
    const unsubSub = subscriptionService.subscribeListener(() => setServiceTick((t) => t + 1));
    const unsubOff = offlineService.subscribe(() => setServiceTick((t) => t + 1));
    return () => {
      unsubSub();
      unsubOff();
    };
  }, []);

  // Detailed subviews
  const [activeAlbumDetail, setActiveAlbumDetail] = useState<EnrichedAlbum | null>(null);
  const [activeArtistDetail, setActiveArtistDetail] = useState<EnrichedArtist | null>(null);
  const [activePlaylistDetail, setActivePlaylistDetail] = useState<Playlist | null>(null);

  // Playlists persistence
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem('vd_user_playlists');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Ensure every playlist has a safe 'tracks' array
          return parsed.map((p: any) => ({
            ...p,
            tracks: Array.isArray(p.tracks) ? p.tracks : []
          }));
        }
      }
    } catch {}
    return [];
  });

  // Module 4: Synchronize Playlists with Cloud Database in Real-Time
  useEffect(() => {
    realtimeSyncService.fetchAccountState().then((acc) => {
      if (acc?.playlists && Array.isArray(acc.playlists) && acc.playlists.length > 0) {
        setPlaylists((prev) => {
          const map = new Map<string, Playlist>();
          acc.playlists.forEach((p: any) => {
            map.set(p.id, { ...p, tracks: Array.isArray(p.tracks) ? p.tracks : [] });
          });
          prev.forEach((p) => {
            map.set(p.id, { ...p, tracks: Array.isArray(p.tracks) ? p.tracks : [] });
          });
          const merged = Array.from(map.values());
          try {
            const sanitizedMerged = merged.map(pl => ({
              ...pl,
              tracks: pl.tracks.map(t => sanitizeTrackForPersistence(t))
            }));
            localStorage.setItem('vd_user_playlists', JSON.stringify(sanitizedMerged));
          } catch {}
          return merged;
        });
      }
    });

    const unsubPl = realtimeSyncService.onPlaylistUpdated((data) => {
      if (data?.playlist) {
        const safePlaylist: Playlist = {
          ...data.playlist,
          tracks: Array.isArray(data.playlist.tracks) ? data.playlist.tracks : []
        };
        setPlaylists((prev) => {
          const filtered = prev.filter((p) => p.id !== safePlaylist.id);
          const updated = [safePlaylist, ...filtered];
          try {
            const sanitizedUpdated = updated.map(pl => ({
              ...pl,
              tracks: pl.tracks.map(t => sanitizeTrackForPersistence(t))
            }));
            localStorage.setItem('vd_user_playlists', JSON.stringify(sanitizedUpdated));
          } catch {}
          return updated;
        });
      }
    });

    return () => unsubPl();
  }, []);

  // Modals for Custom Playlist Management
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [isAddSongsModalOpen, setIsAddSongsModalOpen] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');

  // Extract liked songs
  const likedTracks = useMemo(() => tracks.filter((t) => t.isFavorite), [tracks]);

  // Extract albums and artists from all library tracks
  const albums = useMemo(() => extractAlbums(tracks), [tracks]);
  const artists = useMemo(() => extractArtists(tracks, albums), [tracks, albums]);

  // Fallback play queue handler if not passed by parent
  const handlePlayQueueInternal = (trackList: Track[], startIndex = 0) => {
    if (onPlayQueue) {
      onPlayQueue(trackList, startIndex);
    } else if (trackList.length > 0) {
      onSelectTrack(trackList[startIndex] || trackList[0]);
    }
  };

  const handleToggleDownload = (track: Track) => {
    offlineService.toggleDownload(track);
  };

  const handleDownloadAllLiked = (tracksToDownload: Track[]) => {
    tracksToDownload.forEach((t) => offlineService.downloadTrack(t, false));
  };

  const isDownloaded = (trackId: string) => offlineService.isDownloaded(trackId);

  // Switch tab safely by clearing active detail views
  const handleSwitchTab = (
    tab: 'playlists' | 'liked' | 'albums' | 'artists' | 'subscriptions' | 'history' | 'downloads'
  ) => {
    setActiveAlbumDetail(null);
    setActiveArtistDetail(null);
    setActivePlaylistDetail(null);
    setActiveTab(tab);
  };

  // Create playlist
  const handleCreatePlaylist = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;

    const newPl: Playlist = {
      id: 'pl-' + Date.now(),
      name,
      description: newPlaylistDesc.trim() || undefined,
      createdAt: Date.now(),
      tracks: []
    };

    const updated = [newPl, ...playlists];
    setPlaylists(updated);
    try {
      const sanitizedUpdated = updated.map(pl => ({
        ...pl,
        tracks: pl.tracks.map(t => sanitizeTrackForPersistence(t))
      }));
      localStorage.setItem('vd_user_playlists', JSON.stringify(sanitizedUpdated));
    } catch {}

    // Module 4: Sync playlist to cloud account database in real-time
    realtimeSyncService.syncPlaylist(newPl);

    setNewPlaylistName('');
    setNewPlaylistDesc('');
    setIsCreateModalOpen(false);
    setActivePlaylistDetail(newPl);
  };

  // Delete playlist
  const handleDeletePlaylist = (playlistId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = playlists.filter((p) => p.id !== playlistId);
    setPlaylists(updated);
    try {
      const sanitizedUpdated = updated.map(pl => ({
        ...pl,
        tracks: pl.tracks.map(t => sanitizeTrackForPersistence(t))
      }));
      localStorage.setItem('vd_user_playlists', JSON.stringify(sanitizedUpdated));
    } catch {}

    // Module 4: Sync playlist deletion
    realtimeSyncService.syncDeletePlaylist(playlistId);

    if (activePlaylistDetail?.id === playlistId) {
      setActivePlaylistDetail(null);
    }
  };

  // Toggle song in custom playlist
  const handleToggleSongInPlaylist = (track: Track) => {
    if (!activePlaylistDetail) return;
    const playlistId = activePlaylistDetail.id;

    const exists = activePlaylistDetail.tracks.some((t) => t.id === track.id);
    const updatedTracks = exists
      ? activePlaylistDetail.tracks.filter((t) => t.id !== track.id)
      : [...activePlaylistDetail.tracks, track];

    const updatedPlaylist: Playlist = {
      ...activePlaylistDetail,
      tracks: updatedTracks
    };

    setActivePlaylistDetail(updatedPlaylist);

    const updatedList = playlists.map((p) => (p.id === playlistId ? updatedPlaylist : p));
    setPlaylists(updatedList);
    try {
      const sanitizedList = updatedList.map(pl => ({
        ...pl,
        tracks: pl.tracks.map(t => sanitizeTrackForPersistence(t))
      }));
      localStorage.setItem('vd_user_playlists', JSON.stringify(sanitizedList));
    } catch {}

    // Module 4: Sync playlist update
    realtimeSyncService.syncPlaylist(updatedPlaylist);
  };

  // Tabs metadata
  const TABS = [
    { id: 'playlists', label: 'Playlists', icon: 'queue_music', badge: playlists.length + (likedTracks.length > 0 ? 1 : 0) },
    { id: 'liked', label: 'Liked Songs', icon: 'favorite', badge: likedTracks.length },
    { id: 'albums', label: 'Albums', icon: 'album', badge: albums.length },
    { id: 'artists', label: 'Artists', icon: 'person', badge: artists.length },
    { id: 'subscriptions', label: 'Subscriptions', icon: 'notifications', badge: subscriptionService.getAllSubscribed().length },
    { id: 'history', label: 'History & Activity', icon: 'history', badge: playbackHistory.length },
    { id: 'downloads', label: 'Offline', icon: 'download_for_offline', badge: offlineService.getAllDownloads().length }
  ] as const;

  return (
    <div id="library-screen-view" className="flex flex-col w-full px-4 sm:px-6 gap-5 pb-32 max-w-5xl mx-auto">
      {/* Top Filter Chips Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2">
        {TABS.map((tab) => {
          const isActive =
            activeTab === tab.id &&
            !activeAlbumDetail &&
            !activeArtistDetail &&
            !activePlaylistDetail;

          return (
            <button
              key={tab.id}
              id={`lib-tab-${tab.id}`}
              onClick={() => handleSwitchTab(tab.id as any)}
              className={`h-9 px-3.5 sm:px-4 rounded-xl text-[13px] font-bold flex items-center gap-1.5 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-[var(--color-primary)] text-[#670211] shadow-md'
                  : 'bg-white/[0.06] backdrop-blur-2xl border border-white/[0.08] text-[#a1a1aa] hover:text-[#e4e1e7] hover:bg-white/[0.1]'
              }`}
            >
              <span
                className="material-symbols-outlined floating-icon text-[18px]"
                style={{ fontVariationSettings: isActive && tab.id === 'liked' ? "'FILL' 1" : "'FILL' 0" }}
              >
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? 'bg-black/20 text-[#670211]' : 'bg-white/10 text-[#a1a1aa]'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* RENDER ACTIVE SUBVIEW */}

      {/* 1. Album Detail View */}
      {activeAlbumDetail ? (
        <AlbumDetailView
          album={activeAlbumDetail}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onBack={() => setActiveAlbumDetail(null)}
          onSelectTrack={onSelectTrack}
          onPlayAlbum={handlePlayQueueInternal}
          onToggleFavorite={onToggleFavorite}
          onToggleDownload={handleToggleDownload}
          isDownloaded={isDownloaded}
        />
      ) : activeArtistDetail ? (
        /* 2. Artist Detail View */
        <ArtistDetailView
          artist={activeArtistDetail}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          isSubscribed={subscriptionService.isSubscribed(activeArtistDetail.name)}
          onBack={() => setActiveArtistDetail(null)}
          onSelectTrack={onSelectTrack}
          onPlayArtistTracks={handlePlayQueueInternal}
          onToggleFavorite={onToggleFavorite}
          onToggleSubscription={(name) => {
            subscriptionService.toggleSubscription(name);
            setServiceTick((t) => t + 1);
          }}
          onSelectAlbum={(alb) => setActiveAlbumDetail(alb)}
          onToggleDownload={handleToggleDownload}
          isDownloaded={isDownloaded}
        />
      ) : activePlaylistDetail ? (
        /* 3. Custom Playlist Detail View */
        <div id="playlist-detail-view" className="flex flex-col gap-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActivePlaylistDetail(null)}
              className="flex items-center gap-1.5 text-[13px] font-bold text-[#a1a1aa] hover:text-[#e4e1e7] transition-colors cursor-pointer py-1"
            >
              <span className="material-symbols-outlined floating-icon text-[20px]">arrow_back</span>
              Back to Playlists
            </button>
            <button
              onClick={(e) => handleDeletePlaylist(activePlaylistDetail.id, e)}
              className="text-[12px] text-red-400 hover:text-red-300 font-semibold px-3 py-1 rounded-full bg-red-500/10 hover:bg-red-500/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined floating-icon text-[16px]">delete</span>
              Delete Playlist
            </button>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl liquid-glass border border-white/[0.08] shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-[#2a1b24] to-[#120d13] border border-white/10 flex items-center justify-center text-[var(--color-primary)] shrink-0 shadow-lg relative overflow-hidden">
              {activePlaylistDetail.tracks.length > 0 ? (
                <TrackImage
                  src={activePlaylistDetail.tracks[0].coverUrl}
                  videoId={activePlaylistDetail.tracks[0].videoId}
                  alt={activePlaylistDetail.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="material-symbols-outlined floating-icon text-[44px]">queue_music</span>
              )}
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                Custom Playlist
              </span>
              <h1 className="text-[22px] sm:text-[26px] font-black text-[#e4e1e7] truncate mt-0.5">
                {activePlaylistDetail.name}
              </h1>
              {activePlaylistDetail.description && (
                <p className="text-[13px] text-[#a1a1aa] line-clamp-2 mt-0.5">
                  {activePlaylistDetail.description}
                </p>
              )}
              <span className="text-[12px] text-[#a1a1aa] mt-1">
                {activePlaylistDetail.tracks.length} {activePlaylistDetail.tracks.length === 1 ? 'song' : 'songs'}
              </span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
              {activePlaylistDetail.tracks.length > 0 && (
                <button
                  onClick={() => handlePlayQueueInternal(activePlaylistDetail.tracks, 0)}
                  className="px-5 py-2.5 rounded-full bg-[var(--color-primary)] text-[#670211] text-[13px] font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer floating-btn"
                >
                  <span className="material-symbols-outlined floating-icon text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    play_arrow
                  </span>
                  Play All
                </button>
              )}
              <button
                onClick={() => setIsAddSongsModalOpen(true)}
                className="px-4 py-2.5 rounded-full liquid-glass hover:bg-white/15 text-[#e4e1e7] text-[13px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border border-white/10"
              >
                <span className="material-symbols-outlined floating-icon text-[18px]">add</span>
                Add Songs
              </button>
            </div>
          </div>

          {/* Playlist Track List */}
          <div className="flex flex-col gap-2">
            {activePlaylistDetail.tracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 liquid-glass rounded-2xl border border-white/[0.04]">
                <span className="material-symbols-outlined floating-icon text-[32px] text-[#a1a1aa] mb-2">
                  music_note
                </span>
                <p className="text-[14px] font-bold text-[#e4e1e7]">This playlist is currently empty</p>
                <button
                  onClick={() => setIsAddSongsModalOpen(true)}
                  className="mt-3 px-4 py-2 rounded-full bg-[var(--color-primary)] text-[#670211] text-[12px] font-bold cursor-pointer hover:brightness-110"
                >
                  Add Songs to Playlist
                </button>
              </div>
            ) : (
              activePlaylistDetail.tracks.map((track, idx) => {
                const isThisActive = currentTrack?.id === track.id;
                const downloaded = isDownloaded(track.id);

                return (
                  <div
                    key={track.id}
                    onClick={() => handlePlayQueueInternal(activePlaylistDetail.tracks, idx)}
                    className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer border transition-all ${
                      isThisActive
                        ? 'liquid-glass/90 border-[var(--color-primary)]/40 ring-1 ring-[var(--color-primary)]/25 shadow-md'
                        : 'liquid-glass hover:bg-white/[0.1] hover:border-white/[0.15] border-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-[12px] font-mono text-[#71717a] w-5 text-center">
                        {idx + 1}
                      </span>
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 liquid-glass-heavy">
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
                          {track.artist}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleDownload(track)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                          downloaded ? 'text-emerald-400 bg-emerald-500/10' : 'text-[#71717a] hover:text-[#e4e1e7]'
                        }`}
                      >
                        <span className="material-symbols-outlined floating-icon text-[18px]">
                          {downloaded ? 'check_circle' : 'download'}
                        </span>
                      </button>

                      <button
                        onClick={() => handleToggleSongInPlaylist(track)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#71717a] hover:text-red-400 cursor-pointer"
                        title="Remove from playlist"
                      >
                        <span className="material-symbols-outlined floating-icon text-[18px]">close</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : activeTab === 'liked' ? (
        /* 4. Liked Songs Direct Tab */
        <LikedSongsView
          likedTracks={likedTracks}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onSelectTrack={onSelectTrack}
          onPlayQueue={handlePlayQueueInternal}
          onToggleFavorite={onToggleFavorite}
          onToggleDownload={handleToggleDownload}
          onDownloadAll={handleDownloadAllLiked}
          isDownloaded={isDownloaded}
        />
      ) : activeTab === 'albums' ? (
        /* 5. Albums Grid */
        <div id="albums-section-grid" className="flex flex-col gap-4 animate-fade-in">
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] uppercase font-bold tracking-wider text-[#a1a1aa]">
              All Albums ({albums.length})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {albums.map((alb) => (
              <div
                key={alb.id}
                id={`album-card-${alb.id}`}
                onClick={() => setActiveAlbumDetail(alb)}
                className="liquid-glass hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)] hover:scale-105 p-3 rounded-2xl border border-white/[0.04] cursor-pointer group transition-all flex flex-col"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden mb-2.5 liquid-glass-heavy shadow-md">
                  <TrackImage
                    src={alb.coverUrl}
                    videoId={alb.tracks[0]?.videoId}
                    alt={alb.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="font-bold text-[13px] text-[#e4e1e7] truncate group-hover:text-[var(--color-primary)] transition-colors">
                  {alb.title}
                </h3>
                <span className="text-[12px] text-[#a1a1aa] truncate mt-0.5">{alb.artist}</span>
                <div className="flex items-center gap-1.5 text-[11px] text-[#71717a] mt-1">
                  <span>{alb.year}</span>
                  <span>•</span>
                  <span>{alb.trackCount} {alb.trackCount === 1 ? 'song' : 'songs'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'artists' ? (
        /* 6. Artists Grid */
        <div id="artists-section-grid" className="flex flex-col gap-4 animate-fade-in">
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] uppercase font-bold tracking-wider text-[#a1a1aa]">
              Artists in Library ({artists.length})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {artists.map((artist) => {
              const isSub = subscriptionService.isSubscribed(artist.name);

              return (
                <div
                  key={artist.id}
                  id={`artist-card-${artist.id}`}
                  onClick={() => setActiveArtistDetail(artist)}
                  className="liquid-glass hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)] hover:scale-105 p-4 rounded-2xl border border-white/[0.04] cursor-pointer group transition-all flex flex-col items-center text-center"
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-3 liquid-glass-heavy shadow-md ring-2 ring-white/10 group-hover:ring-[var(--color-primary)] transition-all">
                    <TrackImage
                      src={artist.avatarUrl}
                      videoId={artist.tracks[0]?.videoId}
                      alt={artist.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>

                  <h3 className="font-bold text-[14px] text-[#e4e1e7] truncate w-full group-hover:text-[var(--color-primary)] transition-colors">
                    {artist.name}
                  </h3>

                  <span className="text-[11px] text-[#a1a1aa] mt-0.5">
                    {artist.trackCount} tracks • {artist.albumCount} {artist.albumCount === 1 ? 'album' : 'albums'}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      subscriptionService.toggleSubscription(artist.name);
                      setServiceTick((t) => t + 1);
                    }}
                    className={`mt-3 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                      isSub
                        ? 'bg-white/10 text-[#e4e1e7] border border-white/20'
                        : 'bg-[var(--color-primary)] text-[#670211]'
                    }`}
                  >
                    {isSub ? 'Subscribed' : 'Subscribe'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === 'subscriptions' ? (
        /* 7. Subscriptions Section */
        <SubscriptionsSection
          artists={artists}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onSelectArtist={(artist) => setActiveArtistDetail(artist)}
          onSelectTrack={onSelectTrack}
          onToggleFavorite={onToggleFavorite}
          onToggleDownload={handleToggleDownload}
          isDownloaded={isDownloaded}
        />
      ) : activeTab === 'history' ? (
        /* 8. History & Recent Activity Section */
        <HistorySection
          playbackHistory={playbackHistory}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onSelectTrack={onSelectTrack}
          onPlayHistoryQueue={(q, idx) => handlePlayQueueInternal(q, idx || 0)}
          onClearHistory={onClearHistory}
          onRemoveFromHistory={onRemoveFromHistory}
          onToggleFavorite={onToggleFavorite}
          onToggleDownload={handleToggleDownload}
          isDownloaded={isDownloaded}
        />
      ) : activeTab === 'downloads' ? (
        /* 9. Offline Mode & Downloads Section */
        <OfflineDownloadsSection
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onSelectTrack={onSelectTrack}
          onPlayDownloadedQueue={(q, idx) => handlePlayQueueInternal(q, idx || 0)}
          onToggleFavorite={onToggleFavorite}
          playbackHistory={playbackHistory}
          allTracks={tracks}
        />
      ) : (
        /* 10. Playlists Tab (Includes Liked Songs Auto-Generated Playlist + Custom Playlists) */
        <div id="playlists-tab-content" className="flex flex-col gap-6 animate-fade-in">
          {/* Prominent Auto-Generated Liked Songs Playlist Card */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[12px] uppercase font-bold tracking-wider text-[#a1a1aa] px-1">
              Auto-Generated Playlist
            </span>

            <div
              id="auto-generated-liked-playlist-card"
              onClick={() => handleSwitchTab('liked')}
              className="p-5 rounded-3xl liquid-glass border border-white/[0.08] hover:bg-white/[0.1] hover:border-white/[0.15] cursor-pointer transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl group"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[#ff4760] flex items-center justify-center text-white shrink-0 shadow-lg shadow-[var(--color-primary)]/20 relative overflow-hidden group-hover:scale-105 transition-transform">
                  {likedTracks.length >= 4 ? (
                    <div className="grid grid-cols-2 w-full h-full">
                      {likedTracks.slice(0, 4).map((t) => (
                        <TrackImage
                          key={t.id}
                          src={t.coverUrl}
                          videoId={t.videoId}
                          alt={t.title}
                          className="w-full h-full object-cover opacity-85"
                        />
                      ))}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="material-symbols-outlined floating-icon text-[24px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                          favorite
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="material-symbols-outlined floating-icon text-[34px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      favorite
                    </span>
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] sm:text-[18px] font-black text-[#e4e1e7] truncate group-hover:text-[var(--color-primary)] transition-colors">
                      Liked Songs
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] font-bold text-[10px] uppercase tracking-wider border border-[var(--color-primary)]/25">
                      Auto-Generated
                    </span>
                  </div>
                  <p className="text-[13px] text-[#a1a1aa] mt-0.5">
                    {likedTracks.length} {likedTracks.length === 1 ? 'track' : 'tracks'} • Updated automatically as you favorite music
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {likedTracks.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayQueueInternal(likedTracks, 0);
                    }}
                    className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-[#670211] text-[12px] font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined floating-icon text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      play_arrow
                    </span>
                    Play
                  </button>
                )}
                <span className="material-symbols-outlined floating-icon text-[22px] text-[#a1a1aa] group-hover:text-[#e4e1e7] transition-colors">
                  arrow_forward
                </span>
              </div>
            </div>
          </div>

          {/* User Custom Playlists */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[12px] uppercase font-bold tracking-wider text-[#a1a1aa]">
                Custom Playlists ({playlists.length})
              </span>
              <button
                id="create-playlist-btn"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[var(--color-primary)] text-[#670211] text-[12px] font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined floating-icon text-[16px]">add</span>
                New Playlist
              </button>
            </div>

            {playlists.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 liquid-glass rounded-3xl border border-white/[0.04]">
                <div className="w-14 h-14 rounded-2xl liquid-glass text-[#a1a1aa] flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined floating-icon text-[28px]">queue_music</span>
                </div>
                <h3 className="text-[15px] font-bold text-[#e4e1e7]">No Custom Playlists Yet</h3>
                <p className="text-[12px] text-[#a1a1aa] max-w-xs mt-1 mb-3">
                  Create your own custom mixtapes and organize your favorite songs your way.
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-[#e4e1e7] text-[12px] font-bold cursor-pointer transition-all border border-white/10"
                >
                  Create Your First Playlist
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {playlists.map((pl) => (
                  <div
                    key={pl.id}
                    id={`playlist-card-${pl.id}`}
                    onClick={() => setActivePlaylistDetail(pl)}
                    className="liquid-glass hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)] hover:scale-105 p-3 rounded-2xl border border-white/[0.04] cursor-pointer group transition-all flex flex-col"
                  >
                    <div className="w-full aspect-square rounded-xl overflow-hidden mb-2.5 bg-gradient-to-br from-[#2a1b24] to-[#120d13] border border-white/10 flex items-center justify-center text-[var(--color-primary)] shadow-md">
                      {pl.tracks.length > 0 ? (
                        <TrackImage
                          src={pl.tracks[0].coverUrl}
                          videoId={pl.tracks[0].videoId}
                          alt={pl.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <span className="material-symbols-outlined floating-icon text-[36px]">queue_music</span>
                      )}
                    </div>
                    <h3 className="font-bold text-[13px] text-[#e4e1e7] truncate group-hover:text-[var(--color-primary)] transition-colors">
                      {pl.name}
                    </h3>
                    <span className="text-[11px] text-[#a1a1aa] mt-0.5">
                      {pl.tracks.length} {pl.tracks.length === 1 ? 'song' : 'songs'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE PLAYLIST MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePlaylist}
            className="w-full max-w-md p-6 rounded-3xl liquid-glass-heavy border border-white/15 shadow-2xl flex flex-col gap-4 animate-scale-in"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#e4e1e7]">New Playlist</h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined floating-icon text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold text-[#a1a1aa]">Playlist Name *</label>
              <input
                id="new-playlist-name-input"
                type="text"
                required
                placeholder="e.g. Late Night Vibes"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl liquid-glass border border-white/10 text-[14px] text-white placeholder-white/40 focus:outline-none focus:border-[var(--color-primary)]"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold text-[#a1a1aa]">Description (Optional)</label>
              <textarea
                rows={2}
                placeholder="Give your playlist a mood or description..."
                value={newPlaylistDesc}
                onChange={(e) => setNewPlaylistDesc(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl liquid-glass border border-white/10 text-[13px] text-white placeholder-white/40 focus:outline-none focus:border-[var(--color-primary)] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-full text-[13px] text-[#a1a1aa] hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="submit-create-playlist-btn"
                type="submit"
                className="px-5 py-2 rounded-full bg-[var(--color-primary)] text-[#670211] font-bold text-[13px] cursor-pointer hover:brightness-110 shadow-md"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD SONGS MODAL FOR ACTIVE PLAYLIST */}
      {isAddSongsModalOpen && activePlaylistDetail && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[85vh] p-6 rounded-3xl liquid-glass-heavy border border-white/15 shadow-2xl flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[18px] font-bold text-[#e4e1e7]">Add Songs</h2>
                <p className="text-[12px] text-[#a1a1aa]">to &quot;{activePlaylistDetail.name}&quot;</p>
              </div>
              <button
                onClick={() => setIsAddSongsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined floating-icon text-[20px]">close</span>
              </button>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined floating-icon absolute left-3.5 top-2.5 text-[#a1a1aa] text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search songs to add..."
                value={songSearchQuery}
                onChange={(e) => setSongSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-2xl liquid-glass border border-white/10 text-[13px] text-white placeholder-white/40 focus:outline-none focus:border-[var(--color-primary)]"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[50vh] pr-1 no-scrollbar">
              {tracks
                .filter((t) => {
                  if (!songSearchQuery.trim()) return true;
                  const q = songSearchQuery.toLowerCase();
                  return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
                })
                .map((track) => {
                  const isInPlaylist = activePlaylistDetail.tracks.some((t) => t.id === track.id);

                  return (
                    <div
                      key={track.id}
                      onClick={() => handleToggleSongInPlaylist(track)}
                      className="p-2.5 rounded-2xl liquid-glass hover:bg-white/10 flex items-center justify-between cursor-pointer border border-white/[0.04]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 liquid-glass-heavy">
                          <TrackImage
                            src={track.coverUrl}
                            videoId={track.videoId}
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-bold text-[#e4e1e7] truncate">{track.title}</span>
                          <span className="text-[11px] text-[#a1a1aa] truncate">{track.artist}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          isInPlaylist
                            ? 'bg-[var(--color-primary)] text-[#670211]'
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        <span className="material-symbols-outlined floating-icon text-[18px]">
                          {isInPlaylist ? 'check' : 'add'}
                        </span>
                      </button>
                    </div>
                  );
                })}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={() => setIsAddSongsModalOpen(false)}
                className="px-5 py-2 rounded-full bg-[var(--color-primary)] text-[#670211] font-bold text-[13px] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
