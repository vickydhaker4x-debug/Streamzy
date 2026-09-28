import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  ArrowDown,
  Search,
  X,
  ArrowRight,
  SlidersHorizontal,
  Play,
  Pause,
  Heart,
  Sun,
  Sunset,
  Moon
} from 'lucide-react';
import { Track, Album, MusicMix, MusicVideoItem, TimeOfDay } from '../types';
import { RECOMMENDED_MUSIC_VIDEOS } from '../data/ytmModulesData';
import { TrackImage } from './TrackImage';
import { PersonalizedHomeData, personalizationService, DynamicHomeSection } from '../services/personalizationService';
import { extractAlbums, normalizeAlbumTitle } from '../services/libraryDataService';
import { getTimeContext } from '../utils/timeContext';
import { realtimeSyncService } from '../services/realtimeSyncService';
import { getSongDeduplicationKey } from '../services/musicNormalizationService';

import { offlineService } from '../services/offlineService';

interface HomeScreenProps {
  tracks: Track[];
  favoriteTrackIds: Set<string>;
  currentTrack: Track | null;
  isPlaying: boolean;
  personalizedData?: PersonalizedHomeData;
  playbackHistory?: Track[];
  userName?: string;
  onSelectTrack: (track: Track) => void;
  onPlayQueue?: (tracks: Track[], startIndex?: number) => void;
  onTogglePlay: () => void;
  onToggleFavorite: (trackId: string) => void;
  onOpenVideo?: (video: MusicVideoItem) => void;
  onPlayMix?: (mix: MusicMix) => void;
  onOpenColdStart?: () => void;
  onNavigateToSearch?: (query?: string, source?: string) => void;
}

const HomeScreenComponent: React.FC<HomeScreenProps> = ({
  tracks,
  favoriteTrackIds,
  currentTrack,
  isPlaying,
  personalizedData: externalPersonalizedData,
  playbackHistory = [],
  userName,
  onSelectTrack,
  onPlayQueue,
  onTogglePlay,
  onToggleFavorite,
  onOpenVideo,
  onPlayMix,
  onOpenColdStart,
  onNavigateToSearch
}) => {

  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [homeToast, setHomeToast] = useState<string | null>(null);

  // Time-of-Day Context state (auto detects local time, allows testing different times)
  const [forcedTimeOfDay, setForcedTimeOfDay] = useState<TimeOfDay | null>(null);
  const timeContext = useMemo(() => getTimeContext(forcedTimeOfDay), [forcedTimeOfDay]);

  // Pull-to-refresh state
  const [pullY, setPullY] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const isPulling = useRef<boolean>(false);
  const isHorizontalScroll = useRef<boolean>(false);

  const renderTimeIcon = (iconName: string) => {
    switch (iconName) {
      case 'wb_sunny':
      case 'light_mode':
        return <Sun size={20} />;
      case 'wb_twilight':
        return <Sunset size={20} />;
      case 'bedtime':
      default:
        return <Moon size={20} />;
    }
  };

  // Derive dynamic personalized home data directly or fallback to service generator
  const dynamicHomeData = useMemo(() => {
    return personalizationService.generatePersonalizedHome(
      currentTrack,
      tracks,
      playbackHistory,
      favoriteTrackIds
    );
  }, [currentTrack?.id, tracks.length, playbackHistory.length, favoriteTrackIds.size, refreshCounter]);

  // Active home data (prefers dynamicHomeData with real-time recalculation)
  const homeData = dynamicHomeData || externalPersonalizedData;

  const triggerRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshSuccess(false);

    // Fast non-blocking refresh that preserves existing data without blanking or flickering
    setTimeout(() => {
      setRefreshCounter((c) => c + 1);
      setIsRefreshing(false);
      setRefreshSuccess(true);
      setPullY(0);

      setTimeout(() => {
        setRefreshSuccess(false);
      }, 2000);
    }, 450);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // If user touched inside any horizontal scroll area, do NOT initiate pull-to-refresh
    const target = e.target as HTMLElement | null;
    if (target && target.closest('.overflow-x-auto, [data-horizontal-scroll="true"]')) {
      isPulling.current = false;
      isHorizontalScroll.current = true;
      return;
    }

    if (window.scrollY <= 2 && !isRefreshing) {
      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
      isPulling.current = true;
      isHorizontalScroll.current = false;
    } else {
      isPulling.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing || isHorizontalScroll.current) return;
    
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const diffY = currentY - touchStartY.current;
    const diffX = Math.abs(currentX - touchStartX.current);

    // If horizontal movement is detected, immediately cancel pull-to-refresh
    if (diffX > 8 && diffX > diffY) {
      isHorizontalScroll.current = true;
      isPulling.current = false;
      if (pullY !== 0) setPullY(0);
      return;
    }

    // Only engage pull down if vertical swipe is dominant and user is at top of page
    if (diffY > 15 && diffY > diffX * 1.6 && window.scrollY <= 2) {
      const damping = Math.min((diffY - 15) * 0.35, 65);
      setPullY(damping);
    } else if (diffY <= 0) {
      if (pullY !== 0) setPullY(0);
    }
  };

  const handleTouchEnd = () => {
    isHorizontalScroll.current = false;
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullY >= 45 && !isRefreshing) {
      triggerRefresh();
    } else {
      setPullY(0);
    }
  };

  return (
    <div
      id="home-screen-view"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="flex flex-col w-full pb-10 space-y-7 max-w-4xl mx-auto relative transform-gpu"
      style={{
        transform: pullY > 0 ? `translate3d(0, ${pullY}px, 0)` : 'none',
        transition: pullY === 0 ? 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none'
      }}
    >
      {/* Ambient Time-of-Day Glow extending seamlessly behind header */}
      <div className={`absolute -top-14 left-0 right-0 h-64 bg-gradient-to-b ${timeContext.ambientColor} pointer-events-none rounded-b-3xl -z-10`} />

      {/* Pull-To-Refresh Visual Indicator */}
      {(pullY > 0 || isRefreshing || refreshSuccess) && (
        <div className="flex items-center justify-center py-2 transition-all">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass shadow-lg text-[12px] font-semibold text-[#e4e1e7]">
            {isRefreshing ? (
              <>
                <RefreshCw size={18} className="text-[var(--color-primary)] animate-spin" />
                <span>Refreshing recommendations...</span>
              </>
            ) : refreshSuccess ? (
              <>
                <CheckCircle2 size={18} className="text-green-400" />
                <span className="text-green-300 font-bold">Feed Updated!</span>
              </>
            ) : (
              <>
                <ArrowDown
                  size={18}
                  className="text-[var(--color-primary)] transition-transform"
                  style={{ transform: `rotate(${Math.min(pullY * 4, 360)}deg)` }}
                />
                <span>{pullY > 50 ? 'Release to refresh' : 'Pull down to refresh'}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* GREETING & TIME-OF-DAY CONTEXT HEADER */}
      <div className="px-4 sm:px-6 pt-1 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[var(--color-primary)] shrink-0">
              {renderTimeIcon(timeContext.icon)}
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-[22px] sm:text-[24px] font-black text-white tracking-tight leading-tight truncate">
                {timeContext.greeting}{userName ? `, ${userName}` : ''}
              </h1>
              <p className="text-[12px] text-zinc-400 truncate leading-snug">
                {timeContext.subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SKELETON PLACEHOLDER WHEN DATA IS INITIALIZING */}
      {homeData.sections.length === 0 && (
        <div className="flex flex-col space-y-7 px-4 sm:px-6 animate-pulse">
          {/* Skeleton Section 1 */}
          <div className="flex flex-col space-y-3">
            <div className="w-32 h-3 rounded bg-white/10" />
            <div className="w-48 h-5 rounded bg-white/15" />
            <div className="flex gap-4 overflow-hidden pt-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col space-y-2 w-36 shrink-0">
                  <div className="w-36 h-36 rounded-2xl bg-white/10" />
                  <div className="w-28 h-4 rounded bg-white/10" />
                  <div className="w-20 h-3 rounded bg-white/5" />
                </div>
              ))}
            </div>
          </div>
          {/* Skeleton Section 2 */}
          <div className="flex flex-col space-y-3">
            <div className="w-40 h-5 rounded bg-white/15" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center p-2.5 gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/10 shrink-0" />
                  <div className="flex flex-col gap-1.5 flex-1">
                    <div className="w-3/4 h-3.5 rounded bg-white/10" />
                    <div className="w-1/2 h-3 rounded bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC SECTIONS RENDERED WITH DATA THRESHOLDS & NO DUPLICATE SONGS */}
      {homeData.sections.map((section: DynamicHomeSection) => {
        // -------------------------------------------------------------
        // 1. CONTINUE LISTENING
        // -------------------------------------------------------------
        if (section.type === 'continue_listening' && section.tracks && section.tracks.length > 0) {
          return (
            <div key={section.id} id={section.id} className="flex flex-col space-y-3">
              <div className="px-4 sm:px-6 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--color-primary)] font-bold">
                    Pick up where you left off
                  </span>
                  <h2 className="text-[20px] font-bold text-white tracking-tight">
                    {section.title}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    if (section.tracks && section.tracks.length > 0) onSelectTrack(section.tracks[0]);
                  }}
                  className="text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                >
                  Play all
                </button>
              </div>

              <div 
                data-horizontal-scroll="true" 
                className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6 touch-pan-x overscroll-x-contain"
              >
                <div className="flex items-start gap-4 min-w-max pb-1">
                  {section.tracks.map((track) => {
                    const isThisActive = currentTrack?.id === track.id;
                    return (
                      <div
                        key={`continue-${track.id}`}
                        onClick={() => onSelectTrack(track)}
                        className="flex flex-col w-32 group cursor-pointer"
                      >
                        <div className="relative w-32 h-32 rounded-xl overflow-hidden shadow-md bg-zinc-900 border border-white/[0.06]">
                          <TrackImage
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            src={track.coverUrl}
                            videoId={track.videoId}
                            alt={track.title}
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <div className={`w-9 h-9 rounded-full bg-[var(--color-primary)] text-black flex items-center justify-center shadow-lg transition-transform ${
                              isThisActive ? 'scale-100' : 'opacity-0 group-hover:opacity-100 group-hover:scale-100'
                            }`}>
                              {isThisActive && isPlaying ? (
                                <Pause size={20} className="fill-current" />
                              ) : (
                                <Play size={20} className="fill-current translate-x-0.5" />
                              )}
                            </div>
                          </div>
                          {/* Resume indicator bar */}
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                            <div className="h-full bg-[var(--color-primary)] w-1/3 rounded-r-full" />
                          </div>
                        </div>
                        <span className="text-[13px] font-semibold text-white mt-2 truncate group-hover:text-[var(--color-primary)] transition-colors leading-tight">
                          {track.title}
                        </span>
                        <span className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {track.artist}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }

        // -------------------------------------------------------------
        // 2. BECAUSE YOU LISTENED TO...
        // -------------------------------------------------------------
        if (section.type === 'because_you_listened' && section.tracks && section.tracks.length >= 3) {
          return (
            <div key={section.id} id={section.id} className="flex flex-col space-y-3 pt-1">
              <div className="px-4 sm:px-6 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">
                    Similar Sounds
                  </span>
                  <h2 className="text-[20px] font-bold text-white tracking-tight">
                    {section.title}
                  </h2>
                  {section.subtitle && (
                    <span className="text-[12px] text-zinc-400 truncate">
                      {section.subtitle}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (section.tracks && section.tracks.length > 0) onSelectTrack(section.tracks[0]);
                  }}
                  className="text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                >
                  Play all
                </button>
              </div>

              <div 
                data-horizontal-scroll="true" 
                className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6 touch-pan-x overscroll-x-contain"
              >
                <div className="flex items-start gap-4 min-w-max pb-2">
                  {section.tracks.map((track) => (
                    <div
                      key={`because-${track.id}`}
                      onClick={() => onSelectTrack(track)}
                      className="flex flex-col w-36 group cursor-pointer"
                    >
                      <div className="relative w-36 h-36 rounded-2xl overflow-hidden shadow-lg border border-white/[0.06] bg-zinc-900">
                        <TrackImage
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          src={track.coverUrl}
                          videoId={track.videoId}
                          alt={track.title}
                        />
                        <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors flex items-center justify-center">
                          <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                            <Play size={20} className="fill-current translate-x-0.5" />
                          </div>
                        </div>
                      </div>
                      <span className="text-[13px] font-semibold text-white mt-2 truncate group-hover:text-[var(--color-primary)] transition-colors">
                        {track.title}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {track.artist}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        // -------------------------------------------------------------
        // 4. RECOMMENDED FOR YOU (Carousel)
        // -------------------------------------------------------------
        if (section.type === 'recommended_for_you' && section.tracks && section.tracks.length >= 3) {
          return (
            <div key={section.id} id={section.id} className="flex flex-col space-y-3 pt-1">
              <div className="px-4 sm:px-6 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold">
                    Tailored Discovery
                  </span>
                  <h2 className="text-[20px] font-bold text-white tracking-tight">
                    {section.title}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    if (section.tracks && section.tracks.length > 0) onSelectTrack(section.tracks[0]);
                  }}
                  className="text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                >
                  Play all
                </button>
              </div>

              <div 
                data-horizontal-scroll="true" 
                className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6 touch-pan-x overscroll-x-contain"
              >
                <div className="flex items-start gap-4 min-w-max pb-2">
                  {section.tracks.map((track) => (
                    <div
                      key={`rec-${track.id}`}
                      onClick={() => onSelectTrack(track)}
                      className="flex flex-col w-36 group cursor-pointer"
                    >
                      <div className="relative w-36 h-36 rounded-2xl overflow-hidden shadow-lg border border-white/[0.06] bg-zinc-900">
                        <TrackImage
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          src={track.coverUrl}
                          videoId={track.videoId}
                          alt={track.title}
                        />
                        <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors flex items-center justify-center">
                          <div className="w-9 h-9 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                            <Play size={20} className="fill-current translate-x-0.5" />
                          </div>
                        </div>
                      </div>
                      <span className="text-[13px] font-semibold text-white mt-2 truncate group-hover:text-cyan-300 transition-colors">
                        {track.title}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {track.artist}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        // -------------------------------------------------------------
        // 5. YOUR MIX / MADE FOR YOU (2x2 Collage Stations)
        // -------------------------------------------------------------
        if (section.type === 'mixes' && section.mixes && section.mixes.length >= 2) {
          return (
            <div key={section.id} id={section.id} className="flex flex-col space-y-3 pt-1">
              <div className="px-4 sm:px-6 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--color-primary)] font-bold">
                    Endless Algorithmic Stations
                  </span>
                  <h2 className="text-[20px] font-bold text-white tracking-tight">
                    {section.title}
                  </h2>
                </div>

                {onOpenColdStart && (
                  <button
                    onClick={onOpenColdStart}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-xs font-semibold text-white cursor-pointer transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined floating-icon text-[16px] text-red-400">tune</span>
                    <span>Tune Taste</span>
                  </button>
                )}
              </div>

              <div 
                data-horizontal-scroll="true" 
                className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6 touch-pan-x overscroll-x-contain"
              >
                <div className="flex items-start gap-4 min-w-max pb-2">
                  {section.mixes.map((mix) => (
                    <div
                      key={mix.id}
                      onClick={() => {
                        if (onPlayMix) {
                          onPlayMix(mix);
                        } else {
                          const firstTrack = tracks.find(t => mix.trackIds.includes(t.id)) || tracks[0];
                          if (firstTrack) onSelectTrack(firstTrack);
                        }
                      }}
                      className="flex flex-col w-40 group cursor-pointer"
                    >
                      <div className="relative w-40 h-40 rounded-2xl overflow-hidden shadow-xl border border-white/[0.08] bg-zinc-900 group-hover:border-white/20 transition-all">
                        <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                          {mix.coverGrid.map((imgUrl, idx) => (
                            <img
                              key={idx}
                              src={imgUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ))}
                        </div>

                        <div className={`absolute inset-0 bg-gradient-to-t ${mix.gradient} opacity-40 group-hover:opacity-60 transition-opacity`} />
                        
                        {mix.badge && (
                          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[10px] font-black text-white uppercase tracking-wider">
                            {mix.badge}
                          </div>
                        )}

                        <div className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-2xl opacity-95 group-hover:scale-110 transition-transform">
                          <span className="material-symbols-outlined floating-icon text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            play_arrow
                          </span>
                        </div>
                      </div>

                      <span className="text-[14px] font-bold text-white mt-2 truncate group-hover:text-[var(--color-primary)] transition-colors">
                        {mix.title}
                      </span>
                      <span className="text-[11px] text-zinc-400 line-clamp-2 leading-tight mt-0.5">
                        {mix.subtitle}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        // -------------------------------------------------------------
        // 6. SIMILAR TO YOUR FAVORITES
        // -------------------------------------------------------------
        if (section.type === 'similar_to_favorites' && section.tracks && section.tracks.length >= 3) {
          return (
            <div key={section.id} id={section.id} className="flex flex-col space-y-3 pt-1">
              <div className="px-4 sm:px-6 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-pink-400 font-bold">
                    Based on your likes
                  </span>
                  <h2 className="text-[20px] font-bold text-white tracking-tight">
                    {section.title}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    if (section.tracks && section.tracks.length > 0) onSelectTrack(section.tracks[0]);
                  }}
                  className="text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                >
                  Play all
                </button>
              </div>

              <div 
                data-horizontal-scroll="true" 
                className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6 touch-pan-x overscroll-x-contain"
              >
                <div className="flex items-start gap-4 min-w-max pb-2">
                  {section.tracks.map((track) => (
                    <div
                      key={`sim-fav-${track.id}`}
                      onClick={() => onSelectTrack(track)}
                      className="flex flex-col w-36 group cursor-pointer"
                    >
                      <div className="relative w-36 h-36 rounded-2xl overflow-hidden shadow-lg border border-white/[0.06] bg-zinc-900">
                        <TrackImage
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          src={track.coverUrl}
                          videoId={track.videoId}
                          alt={track.title}
                        />
                        <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-pink-400">
                          <span className="material-symbols-outlined floating-icon text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            favorite
                          </span>
                        </div>
                        <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors flex items-center justify-center">
                          <div className="w-9 h-9 rounded-full bg-pink-500 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined floating-icon text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                              play_arrow
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[13px] font-semibold text-white mt-2 truncate group-hover:text-pink-400 transition-colors">
                        {track.title}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {track.artist}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }



        // -------------------------------------------------------------
        // 8. NEW RELEASES
        // -------------------------------------------------------------
        if (section.type === 'new_releases' && section.tracks && section.tracks.length >= 3) {
          return (
            <div key={section.id} id={section.id} className="flex flex-col space-y-3 pt-1">
              <div className="px-4 sm:px-6 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-rose-400 font-bold">
                    Fresh Drops
                  </span>
                  <h2 className="text-[20px] font-bold text-white tracking-tight">
                    {section.title}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    if (section.tracks && section.tracks.length > 0) onSelectTrack(section.tracks[0]);
                  }}
                  className="text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                >
                  Play all
                </button>
              </div>

              <div 
                data-horizontal-scroll="true" 
                className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6 touch-pan-x overscroll-x-contain"
              >
                <div className="flex items-start gap-4 min-w-max pb-2">
                  {section.tracks.map((track) => (
                    <div
                      key={`new-rel-${track.id}`}
                      onClick={() => onSelectTrack(track)}
                      className="flex flex-col w-36 group cursor-pointer"
                    >
                      <div className="relative w-36 h-36 rounded-2xl overflow-hidden shadow-lg border border-white/[0.06] bg-zinc-900">
                        <TrackImage
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          src={track.coverUrl}
                          videoId={track.videoId}
                          alt={track.title}
                        />
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[10px] font-bold text-white uppercase">
                          Single
                        </div>
                        <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all">
                          <span className="material-symbols-outlined floating-icon text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            play_arrow
                          </span>
                        </div>
                      </div>
                      <span className="text-[13px] font-semibold text-white mt-2 truncate group-hover:text-rose-400 transition-colors">
                        {track.title}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate">
                        {track.artist}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        // -------------------------------------------------------------
        // 9. ARTIST RECOMMENDATIONS
        // -------------------------------------------------------------
        if (section.type === 'artists' && section.artists && section.artists.length >= 3) {
          return (
            <div key={section.id} id={section.id} className="flex flex-col space-y-3 pt-1">
              <div className="px-4 sm:px-6 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">
                    Featured Creators
                  </span>
                  <h2 className="text-[20px] font-bold text-white tracking-tight">
                    {section.title}
                  </h2>
                </div>
              </div>

              <div 
                data-horizontal-scroll="true" 
                className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6 touch-pan-x overscroll-x-contain"
              >
                <div className="flex items-start gap-5 min-w-max pb-2">
                  {section.artists.map((artist) => (
                    <div
                      key={artist.id}
                      onClick={() => {
                        if (artist.topTrack) {
                          onSelectTrack(artist.topTrack);
                        }
                      }}
                      className="flex flex-col items-center w-32 group cursor-pointer text-center"
                    >
                      <div className="relative w-28 h-28 rounded-full overflow-hidden shadow-lg border-2 border-white/10 group-hover:border-[var(--color-primary)] transition-all bg-zinc-900">
                        <img
                          src={artist.avatarUrl}
                          alt={artist.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <div className="w-9 h-9 rounded-full bg-[var(--color-primary)] text-black flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all">
                            <span className="material-symbols-outlined floating-icon text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                              play_arrow
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[13px] font-semibold text-white mt-2 truncate w-full group-hover:text-[var(--color-primary)] transition-colors">
                        {artist.name}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate w-full">
                        {artist.monthlyListeners ? `${artist.monthlyListeners} monthly` : 'Artist'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        // -------------------------------------------------------------
        // 10. ALBUM RECOMMENDATIONS
        // -------------------------------------------------------------
        if (section.type === 'albums' && section.albums && section.albums.length >= 2) {
          return (
            <div key={section.id} id={section.id} className="flex flex-col space-y-3 pt-1">
              <div className="px-4 sm:px-6 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold">
                    Full Projects
                  </span>
                  <h2 className="text-[20px] font-bold text-white tracking-tight">
                    {section.title}
                  </h2>
                </div>
              </div>

              <div 
                data-horizontal-scroll="true" 
                className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6 touch-pan-x overscroll-x-contain"
              >
                <div className="flex items-start gap-4 min-w-max pb-2">
                  {section.albums.map((album) => (
                    <div
                      key={album.id}
                      onClick={() => {
                        const allExtracted = extractAlbums(tracks);
                        const normTarget = normalizeAlbumTitle(album.title).toLowerCase();
                        const matchedAlbum = allExtracted.find(a => 
                          a.id === album.id || 
                          a.title.toLowerCase() === album.title.toLowerCase() ||
                          normalizeAlbumTitle(a.title).toLowerCase() === normTarget
                        );
                        let albTracks = matchedAlbum?.tracks || [];
                        if (albTracks.length === 0) {
                          albTracks = tracks.filter(t => {
                            const tNorm = normalizeAlbumTitle(t.album || '', t.title).toLowerCase();
                            return tNorm.includes(normTarget) || normTarget.includes(tNorm) ||
                              (album.artist && t.artist.toLowerCase().includes(album.artist.toLowerCase()));
                          });
                        }
                        if (albTracks.length > 0) {
                          if (onPlayQueue) {
                            onPlayQueue(albTracks, 0);
                          } else {
                            onSelectTrack(albTracks[0]);
                          }
                        } else if (tracks.length > 0) {
                          onSelectTrack(tracks[0]);
                        }
                      }}
                      className="flex flex-col w-36 group cursor-pointer"
                    >
                      <div className="relative w-36 h-36 rounded-2xl overflow-hidden shadow-lg border border-white/[0.06] bg-zinc-900">
                        <img
                          src={album.coverUrl}
                          alt={album.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[10px] font-bold text-white uppercase">
                          Album • {album.year}
                        </div>
                        <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all">
                          <span className="material-symbols-outlined floating-icon text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            play_arrow
                          </span>
                        </div>
                      </div>
                      <span className="text-[13px] font-semibold text-white mt-2 truncate group-hover:text-indigo-400 transition-colors">
                        {album.title}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate">
                        {album.artist}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        return null;
      })}

      {/* RECOMMENDED MUSIC VIDEOS (YouTube Official Widescreen Clips) */}
      <div className="flex flex-col space-y-3 pt-1">
        <div className="px-4 sm:px-6 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-red-500 font-bold">
              From YouTube & Official Channels
            </span>
            <h2 className="text-[20px] font-bold text-white tracking-tight">
              Recommended music videos
            </h2>
          </div>
        </div>

        <div 
          data-horizontal-scroll="true" 
          className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6 touch-pan-x overscroll-x-contain"
        >
          <div className="flex items-start gap-4 min-w-max pb-2">
            {RECOMMENDED_MUSIC_VIDEOS.map((video) => (
              <div
                key={`rec-vid-${video.id}`}
                onClick={() => {
                  if (onOpenVideo) {
                    onOpenVideo(video);
                  } else {
                    const matchingTrack = tracks.find(t => t.videoId === video.videoId);
                    if (matchingTrack) onSelectTrack(matchingTrack);
                  }
                }}
                className="flex flex-col w-64 group cursor-pointer"
              >
                <div className="relative w-64 aspect-video rounded-2xl overflow-hidden shadow-lg border border-white/[0.08] bg-black">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined floating-icon text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        play_arrow
                      </span>
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-bold text-white">
                    {video.duration}
                  </div>
                </div>

                <span className="text-[13px] font-semibold text-white mt-2 truncate group-hover:text-red-400 transition-colors leading-tight">
                  {video.title}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                  <span className="truncate">{video.artist}</span>
                  <span>•</span>
                  <span>{video.views}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dynamic Download & Action Feedback Toast */}
      {homeToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 w-full max-w-sm">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-black/90 backdrop-blur-xl border border-white/20 shadow-2xl text-white text-xs font-semibold">
            <span className="material-symbols-outlined text-emerald-400 text-[18px]">
              check_circle
            </span>
            <span className="truncate">{homeToast}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const HomeScreen = React.memo(HomeScreenComponent);
