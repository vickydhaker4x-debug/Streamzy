import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Track, SettingsState } from '../types';
import { TRACKS } from '../data/musicData';
import { TrackImage } from './TrackImage';
import { extractAmbientPalette, AmbientPalette, getFallbackPalette } from '../utils/colorExtractor';
import { lyricsService } from '../services/lyricsService';
import { offlineService } from '../services/offlineService';
import { personalizationService } from '../services/personalizationService';
import { QueueDrawer } from './QueueDrawer';
import { EqualizerModal } from './EqualizerModal';
import { FullscreenLyricsModal } from './FullscreenLyricsModal';

interface NowPlayingScreenProps {
  currentTrack: Track;
  isPlaying: boolean;
  currentTimeSec: number;
  settings: SettingsState;
  queue?: Track[];
  currentVibe?: string;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'all' | 'one' | 'off';
  onToggleRepeat: () => void;
  onSelectTrack?: (track: Track) => void;
  onPlayFromQueue?: (track: Track, index: number) => void;
  onRemoveFromQueue?: (index: number) => void;
  onReorderQueue?: (startIndex: number, endIndex: number) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onClearQueue?: () => void;
  onShuffleQueue?: () => void;
  onPrioritizeQueue?: () => void;
  isInfiniteAutoPlay?: boolean;
  onToggleInfiniteAutoPlay?: () => void;
  radioTracks?: Track[];
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSeek: (seconds: number) => void;
  onClose: () => void;
  onToggleFavorite: (trackId: string) => void;
  onToggleDislike?: (trackId: string) => void;
  onUpdateSettings: (newSettings: Partial<SettingsState>) => void;
}

export const NowPlayingScreen: React.FC<NowPlayingScreenProps> = ({
  currentTrack,
  isPlaying,
  currentTimeSec,
  settings,
  queue = [],
  currentVibe,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
  onSelectTrack,
  onPlayFromQueue,
  onRemoveFromQueue,
  onReorderQueue,
  onPlayNext,
  onAddToQueue,
  onClearQueue,
  onShuffleQueue,
  onPrioritizeQueue,
  isInfiniteAutoPlay = true,
  onToggleInfiniteAutoPlay,
  radioTracks = [],
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onSeek,
  onClose,
  onToggleFavorite,
  onToggleDislike,
  onUpdateSettings
}) => {
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [showEqSubModal, setShowEqSubModal] = useState(false);
  const [, setOfflineTick] = useState(0);

  useEffect(() => {
    const unsub = offlineService.subscribe(() => setOfflineTick((t) => t + 1));
    return unsub;
  }, []);

  const isDownloaded = offlineService.isDownloaded(currentTrack.id);
  const isDownloading = offlineService.isDownloading(currentTrack.id);
  const downloadProgress = offlineService.getDownloadProgress(currentTrack.id);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  };
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgressSec, setDragProgressSec] = useState(currentTimeSec);

  // Dynamic ambient palette extracted from thumbnail
  const [palette, setPalette] = useState<AmbientPalette>(() =>
    getFallbackPalette(currentTrack.id + currentTrack.title)
  );

  const progressBarRef = useRef<HTMLDivElement>(null);

  // Extract ambient colors whenever currentTrack changes
  useEffect(() => {
    let isCancelled = false;
    extractAmbientPalette(currentTrack.coverUrl, currentTrack.id + currentTrack.title)
      .then((extracted) => {
        if (!isCancelled) {
          setPalette(extracted);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [currentTrack.coverUrl, currentTrack.id, currentTrack.title]);

  useEffect(() => {
    if (!isDragging) {
      setDragProgressSec(currentTimeSec);
    }
  }, [currentTimeSec, isDragging]);

  const durationSec = currentTrack.durationSec || 240;
  const activeSec = isDragging ? dragProgressSec : currentTimeSec;
  const progressPercent = Math.min(100, Math.max(0, (activeSec / durationSec) * 100));

  // Lyrics derived via lyricsService (always available for every song)
  const trackLyrics = useMemo(() => {
    return lyricsService.getTrackLyrics(currentTrack);
  }, [currentTrack]);

  const lyricState = useMemo(() => {
    return lyricsService.getCurrentLyricState(trackLyrics, activeSec);
  }, [trackLyrics, activeSec]);

  const activeLyricRef = useRef<HTMLParagraphElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll lyrics smoothly into center viewport
  useEffect(() => {
    if (showLyrics && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [lyricState.currentIndex, showLyrics]);

  // Smart Previous is handled globally in onPrevTrack based on user threshold and queue history
  const handleSmartPrev = () => {
    onPrevTrack();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSeekFromClientX = (clientX: number) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newSec = Math.floor(ratio * durationSec);
    setDragProgressSec(newSec);
    onSeek(newSec);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleSeekFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleSeekFromClientX(e.clientX);
    }
  };

  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  const handleShare = async () => {
    const shareText = `Listening to "${currentTrack.title}" by ${currentTrack.artist} on Streamzy!`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: currentTrack.title,
          text: shareText,
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
        setToastMessage('Link copied to clipboard!');
        setTimeout(() => setToastMessage(null), 2500);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${currentTrack.title} - ${currentTrack.artist}`);
        setToastMessage('Track title copied!');
        setTimeout(() => setToastMessage(null), 2500);
      } catch {}
    }
  };

  const timerPresets = [15, 30, 45, 60, null];
  const eqPresets = ['Bass Boost & Vocal', 'Electronic', 'Acoustic', 'Chillout', 'Flat'];
  const displayQueue = queue && queue.length > 0 ? queue : TRACKS;

  return (
    <div
      id="now-playing-fullscreen"
      className="fixed inset-0 z-50 flex flex-col select-none overflow-hidden transition-all duration-700 ease-out"
      style={{
        background: palette.gradientCss
      }}
      onPointerUp={handlePointerUp}
    >
      {/* Heavily Blurred Album Art Background for Depth */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-black/50">
        <img 
          src={currentTrack.coverUrl || '/streamzy_logo.jpg'} 
          alt="Ambient Background" 
          className="w-full h-full object-cover blur-[140px] opacity-65 scale-135 saturate-[1.7] transition-all duration-1000 ease-in-out"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/65"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-transparent to-black/95"></div>
      </div>

      {/* Soft Ambient Blur Layers for Depth & Glow */}
      <div 
        className="absolute -top-24 -left-24 w-[500px] h-[500px] rounded-full pointer-events-none opacity-50 transition-colors duration-1000"
        style={{ background: palette.topColor, filter: 'blur(120px)' }}
      />
      <div 
        className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full pointer-events-none opacity-60 transition-colors duration-1000"
        style={{ background: palette.bottomColor, filter: 'blur(140px)' }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/80 text-white text-[12px] font-semibold shadow-2xl backdrop-blur-md border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="material-symbols-outlined floating-icon text-[16px] text-white">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Responsive Layout Container */}
      <div className="relative z-10 w-full max-w-md mx-auto h-full flex flex-col justify-between px-6 pt-[max(env(safe-area-inset-top,0px),16px)] pb-[max(env(safe-area-inset-bottom,0px),16px)]">

        {/* 1. Header (Centered OpenTune style with back chevron) */}
        <header className="relative w-full flex items-center justify-between py-2 shrink-0">
          <button
            id="now-playing-close-btn"
            aria-label="Minimize player"
            onClick={onClose}
            className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-white/90 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer floating-btn"
          >
            <span className="material-symbols-outlined floating-icon text-[28px]">keyboard_arrow_down</span>
          </button>

          <div className="flex flex-col items-center justify-center text-center px-2 flex-1 min-w-0">
            <span className="text-[14px] font-semibold text-white/90 tracking-wide">
              Now Playing
            </span>
            <span className="text-[13px] font-medium text-white/80 truncate w-full max-w-[270px] mt-0.5">
              {currentTrack.album || currentTrack.title} {currentTrack.artist ? `• ${currentTrack.artist}` : ''}
            </span>
          </div>

          <div className="flex items-center justify-end gap-1 -mr-2">
            <button
              aria-label="Audio options"
              onClick={() => setShowMenuModal(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined floating-icon text-[20px]">tune</span>
            </button>
          </div>
        </header>

        {/* 2. Centerpiece: Album Artwork or Synced Lyrics */}
        <div className="w-full flex-1 flex flex-col justify-center items-center my-auto py-2">
          {showLyrics ? (
            <div 
              ref={lyricsContainerRef}
              className="w-full max-w-[340px] aspect-square rounded-[28px] bg-black/40 backdrop-blur-2xl p-6 overflow-y-auto no-scrollbar border border-white/10 flex flex-col space-y-3 text-center shadow-2xl relative"
            >
              <div className="sticky top-0 z-10 bg-black/40 backdrop-blur-md -mx-6 -mt-6 px-6 py-2.5 mb-2 border-b border-white/10 flex items-center justify-between text-white/70 text-[11px] uppercase tracking-wider font-bold">
                <span className="flex items-center gap-1.5 text-white/90">
                  <span className="material-symbols-outlined text-[15px] text-[var(--color-primary)] animate-pulse">lyrics</span>
                  Synced Lyrics
                </span>
                {lyricState.isInstrumental ? (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-emerald-300 font-semibold text-[10px] animate-pulse">
                    Instrumental
                  </span>
                ) : lyricState.secondsToNextVocal > 3 ? (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[var(--color-primary)] font-semibold text-[10px]">
                    Vocal in {lyricState.secondsToNextVocal}s
                  </span>
                ) : (
                  <span className="text-white/80 font-mono text-[10.5px]">Auto-Scroll ON</span>
                )}
              </div>

              {trackLyrics.length > 0 ? (
                trackLyrics.map((line, idx) => {
                  const isCurrentLine = idx === lyricState.currentIndex;
                  const isPast = idx < lyricState.currentIndex;
                  const isInstrumental = line.text.startsWith('♪') && line.text.endsWith('♪');

                  return (
                    <div
                      key={`lyric-line-${idx}`}
                      ref={isCurrentLine ? activeLyricRef : null}
                      onClick={() => {
                        onSeek(line.time);
                        setDragProgressSec(line.time);
                      }}
                      className={`transition-all duration-300 cursor-pointer py-2 px-3 rounded-xl select-none ${
                        isCurrentLine
                          ? 'bg-white/15 text-white font-extrabold text-[17px] sm:text-[18px] scale-[1.03] shadow-lg drop-shadow-[0_0_16px_rgba(255,255,255,0.7)]'
                          : isPast
                          ? 'text-white/40 hover:text-white/70 text-[14.5px]'
                          : 'text-white/60 hover:text-white/90 text-[14.5px]'
                      }`}
                    >
                      <p className={`${isInstrumental ? 'italic text-emerald-300/90 text-[13.5px]' : ''}`}>
                        {line.text}
                      </p>
                      {/* Active vocal progress pill */}
                      {isCurrentLine && (
                        <div className="w-16 h-0.5 bg-white/60 rounded-full mx-auto mt-1.5 overflow-hidden">
                          <div
                            style={{ width: `${Math.round(lyricState.progressInLine * 100)}%` }}
                            className="h-full bg-white transition-all duration-200"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-white/60 text-[14px]">
                  <span className="material-symbols-outlined floating-icon text-[32px] mb-2 opacity-50">music_off</span>
                  <span>Instrumental track or lyrics unavailable</span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full aspect-square max-w-[260px] relative mx-auto group">
              <div
                className={`w-full h-full rounded-[24px] overflow-hidden bg-black/40 relative shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7)] border border-white/10 transition-transform duration-500 ${
                  isPlaying ? 'scale-100' : 'scale-[0.98] opacity-95'
                }`}
              >
                <TrackImage
                  className="w-full h-full object-cover"
                  src={currentTrack.coverUrl}
                  videoId={currentTrack.videoId}
                  alt={currentTrack.title}
                  loading="eager"
                  showCornerGlow={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. Track Info & Action Icons Row (Exact Screenshot Alignment) */}
        <div className="w-full flex items-center justify-between mt-1 mb-2 shrink-0">
          <div className="flex flex-col min-w-0 pr-3">
            <h1 className="text-[20px] sm:text-[22px] font-bold text-white tracking-tight leading-tight truncate drop-shadow-sm">
              {currentTrack.title}
            </h1>
            <span className="text-[14px] text-white/75 font-medium truncate mt-0.5">
              {currentTrack.artist}
            </span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {/* Share Button */}
            <button
              id="now-playing-share-btn"
              aria-label="Share track"
              onClick={handleShare}
              className="w-10 h-10 flex items-center justify-center text-white/85 hover:text-white active:scale-85 transition-all cursor-pointer floating-btn"
            >
              <span className="material-symbols-outlined floating-icon text-[24px]">share</span>
            </button>

            {/* Dislike / Thumbs Down Button */}
            <button
              id="now-playing-dislike-btn"
              aria-label="Dislike track"
              onClick={() => {
                const nowDisliked = personalizationService.toggleDislike(currentTrack.id);
                if (onToggleDislike) onToggleDislike(currentTrack.id);
                if (nowDisliked) {
                  showToast("We won't recommend this track again");
                  setTimeout(() => {
                    onNextTrack();
                  }, 600);
                } else {
                  showToast("Removed dislike");
                }
              }}
              className="w-10 h-10 flex items-center justify-center text-white active:scale-85 transition-all cursor-pointer"
            >
              <span
                className={`material-symbols-outlined text-[24px] ${
                  personalizationService.isDisliked(currentTrack.id) ? 'text-red-400' : 'text-white/70 hover:text-white'
                }`}
                style={personalizationService.isDisliked(currentTrack.id) ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                thumb_down
              </span>
            </button>

            {/* Favorite / Thumbs Up Button */}
            <button
              id="now-playing-favorite-btn"
              aria-label="Favorite track"
              onClick={() => {
                onToggleFavorite(currentTrack.id);
                personalizationService.toggleLike(currentTrack.id, currentTrack.isFavorite);
              }}
              className="w-10 h-10 flex items-center justify-center text-white active:scale-85 transition-all cursor-pointer"
            >
              <span
                className={`material-symbols-outlined text-[26px] ${
                  currentTrack.isFavorite || personalizationService.isLiked(currentTrack.id) ? 'text-rose-400' : 'text-white/85 hover:text-white'
                }`}
                style={currentTrack.isFavorite || personalizationService.isLiked(currentTrack.id) ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {currentTrack.isFavorite || personalizationService.isLiked(currentTrack.id) ? 'favorite' : 'favorite'}
              </span>
            </button>

            {/* Offline Encrypted Download Button */}
            <button
              id="now-playing-download-btn"
              aria-label={isDownloaded ? 'Downloaded to offline encrypted vault' : 'Download for offline playback'}
              title={isDownloaded ? 'Downloaded & AES-256 Encrypted' : 'Download to Local Vault'}
              onClick={() => {
                const isNowDownloaded = offlineService.toggleDownload(currentTrack);
                if (isNowDownloaded) {
                  showToast('Encrypted with AES-256 & saved to offline vault');
                } else {
                  showToast('Removed from offline downloads');
                }
              }}
              className="w-10 h-10 flex items-center justify-center text-white active:scale-85 transition-all cursor-pointer relative"
            >
              {isDownloading ? (
                <span className="material-symbols-outlined text-[22px] text-amber-300 animate-spin">
                  progress_activity
                </span>
              ) : isDownloaded ? (
                <div className="flex items-center justify-center text-emerald-400">
                  <span className="material-symbols-outlined text-[24px]">
                    download_for_offline
                  </span>
                </div>
              ) : (
                <span className="material-symbols-outlined text-[24px] text-white/85 hover:text-white">
                  download
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 4. Signature OpenTune / Android 13+ Progress Bar Scrubber */}
        <div className="w-full flex flex-col shrink-0 mb-3">
          <div
            id="now-playing-scrubber"
            ref={progressBarRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            className="relative w-full h-8 flex items-center cursor-pointer select-none touch-none group"
          >
            {/* Track Background (Unplayed - semi-transparent muted bar with rounded tip) */}
            <div className="relative w-full h-[9px] rounded-full bg-white/25 overflow-visible">
              {/* Active Played Progress Pill */}
              <div
                style={{ width: `${progressPercent}%` }}
                className="h-full bg-white rounded-full relative"
              />

              {/* Vertical Pill Thumb / Cursor Indicator */}
              <div
                style={{ left: `${progressPercent}%` }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[5px] h-[22px] rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.6)] pointer-events-none group-active:scale-110 transition-transform"
              />

              {/* Right End Dot (matching screenshot) */}
              <div className="absolute right-1 top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full bg-white/60 pointer-events-none" />
            </div>
          </div>

          {/* Time Labels */}
          <div className="flex justify-between items-center text-[13px] font-medium text-white/90 px-0.5 -mt-1">
            <span>{formatTime(activeSec)}</span>
            <span>{formatTime(durationSec)}</span>
          </div>
        </div>

        {/* 5. Main Controls Row (Exact Screenshot: Shuffle, Prev, Center Play/Pause, Next, Repeat) */}
        <div className="w-full flex items-center justify-between px-2 shrink-0 mb-4">
          {/* Shuffle Mode */}
          <button
            id="now-playing-shuffle-btn"
            aria-label="Shuffle mode"
            onClick={onToggleShuffle}
            className={`w-11 h-11 flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
              isShuffle ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <span
              className="material-symbols-outlined floating-icon text-[24px]"
              style={isShuffle ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              shuffle
            </span>
          </button>

          {/* Previous Track (Rounded squircle button) */}
          <button
            id="now-playing-prev-btn"
            aria-label="Previous track"
            onClick={handleSmartPrev}
            className="w-12 h-12 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 flex items-center justify-center text-white transition-all cursor-pointer shadow-md floating-btn"
          >
            <span
              className="material-symbols-outlined floating-icon text-[26px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              skip_previous
            </span>
          </button>

          {/* Primary Play / Pause Button (Large pure white circle with black icon) */}
          <button
            id="now-playing-play-pause-btn"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={onTogglePlay}
            className="w-15 h-15 rounded-full bg-white text-black shadow-2xl hover:scale-105 active:scale-95 flex items-center justify-center transition-all cursor-pointer floating-btn"
          >
            <span
              className="material-symbols-outlined floating-icon text-[32px] text-black"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          {/* Next Track (Rounded squircle button) */}
          <button
            id="now-playing-next-btn"
            aria-label="Next track"
            onClick={onNextTrack}
            className="w-12 h-12 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 flex items-center justify-center text-white transition-all cursor-pointer shadow-md floating-btn"
          >
            <span
              className="material-symbols-outlined floating-icon text-[26px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              skip_next
            </span>
          </button>

          {/* Repeat Mode */}
          <button
            id="now-playing-repeat-btn"
            aria-label={repeatMode === 'one' ? 'Repeat one track' : repeatMode === 'all' ? 'Repeat entire queue' : 'Repeat off'}
            title={repeatMode === 'one' ? 'Repeat One' : repeatMode === 'all' ? 'Repeat Queue' : 'Repeat Off'}
            onClick={onToggleRepeat}
            className={`w-11 h-11 flex items-center justify-center transition-all active:scale-90 cursor-pointer relative ${
              repeatMode !== 'off' ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <span
              className="material-symbols-outlined floating-icon text-[24px]"
              style={repeatMode !== 'off' ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
            </span>
            {repeatMode === 'all' && (
              <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-white" />
            )}
          </button>
        </div>

        {/* 6. Bottom Secondary Navigation Row (Queue, Sleep Timer, Lyrics, More) */}
        <nav className="w-full flex items-center justify-around pt-3 border-t border-white/10 shrink-0 text-white/80">
          {/* Queue Button */}
          <button
            id="open-queue-btn"
            aria-label="Open queue"
            onClick={() => setShowQueue(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined floating-icon text-[20px]">format_list_bulleted</span>
            <span className="text-[13px] font-medium">Queue</span>
          </button>

          {/* Sleep Timer Button */}
          <button
            id="open-sleep-btn"
            aria-label="Sleep timer"
            onClick={() => setShowSleepModal(true)}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 active:scale-95 transition-all cursor-pointer relative"
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                settings.sleepTimerRemaining ? 'text-amber-300' : 'text-white/80'
              }`}
            >
              nightlight
            </span>
            {settings.sleepTimerRemaining && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          {/* Lyrics Button */}
          <button
            id="toggle-lyrics-bottom-btn"
            aria-label="Toggle lyrics"
            onClick={() => setShowLyrics(!showLyrics)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 active:scale-95 transition-all cursor-pointer ${
              showLyrics ? 'bg-white/20 text-white' : ''
            }`}
          >
            <span className="material-symbols-outlined floating-icon text-[20px]">notes</span>
            <span className="text-[13px] font-medium">Lyrics</span>
          </button>

          {/* More Options Button */}
          <button
            id="open-more-menu-btn"
            aria-label="More options"
            onClick={() => setShowMenuModal(true)}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined floating-icon text-[22px]">more_vert</span>
          </button>
        </nav>

      </div>

      {/* --- MODALS & DRAWERS --- */}

      {/* A. Dynamic Up-Next Queue Drawer */}
      <QueueDrawer
        isOpen={showQueue}
        onClose={() => setShowQueue(false)}
        currentTrack={currentTrack}
        queue={queue}
        onPlayFromQueue={(t, idx) => {
          if (onPlayFromQueue) {
            onPlayFromQueue(t, idx);
          } else if (onSelectTrack) {
            onSelectTrack(t);
          }
          setShowQueue(false);
        }}
        onRemoveFromQueue={onRemoveFromQueue || (() => {})}
        onReorderQueue={onReorderQueue || (() => {})}
        onPlayNext={onPlayNext || (() => {})}
        onAddToQueue={onAddToQueue || (() => {})}
        onClearQueue={onClearQueue || (() => {})}
        onShuffleQueue={onShuffleQueue || (() => {})}
        onPrioritizeQueue={onPrioritizeQueue}
        isInfiniteAutoPlay={isInfiniteAutoPlay}
        onToggleInfiniteAutoPlay={onToggleInfiniteAutoPlay || (() => {})}
        radioTracks={radioTracks}
        currentVibe={currentVibe}
        onToggleFavorite={onToggleFavorite}
        onSelectTrack={(t) => {
          if (onSelectTrack) onSelectTrack(t);
          setShowQueue(false);
        }}
      />

      {/* Karaoke Synced Lyrics Modal */}
      <FullscreenLyricsModal
        isOpen={showLyrics}
        onClose={() => setShowLyrics(false)}
        track={currentTrack}
        currentTimeSec={currentTimeSec}
        onSeek={onSeek}
      />

      {/* 10-Band DSP Equalizer Modal */}
      <EqualizerModal
        isOpen={showEqSubModal}
        onClose={() => setShowEqSubModal(false)}
        currentPreset={settings.equalizerPreset}
        onPresetChange={(preset, bands) => {
          onUpdateSettings({ equalizerPreset: preset, equalizerBands: bands });
          showToast(`Preset: ${preset}`);
        }}
        crossfadeSec={settings.crossfadeDurationSec || 3}
        onCrossfadeChange={(sec) => {
          onUpdateSettings({ crossfadeDurationSec: sec });
          showToast(`Crossfade: ${sec}s`);
        }}
      />

      {/* B. Sleep Timer Modal */}
      {showSleepModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-md mx-auto liquid-glass rounded-t-[32px] p-5 shadow-2xl border-t border-white/10">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined floating-icon text-amber-300">nightlight</span>
                <span className="text-[16px] font-bold text-white">Sleep Timer</span>
              </div>
              <button
                onClick={() => setShowSleepModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined floating-icon text-[18px]">close</span>
              </button>
            </div>

            <p className="text-[12px] text-white/70 mt-3 mb-4">
              Music will automatically fade out and stop after the set time.
            </p>

            <div className="grid grid-cols-3 gap-2.5">
              {timerPresets.map((mins, idx) => {
                const isSelected = settings.sleepTimerRemaining === mins;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      onUpdateSettings({ sleepTimerRemaining: mins });
                      setToastMessage(mins ? `Sleep timer set to ${mins} minutes` : 'Sleep timer turned off');
                      setTimeout(() => setToastMessage(null), 2500);
                      setShowSleepModal(false);
                    }}
                    className={`py-3 px-4 rounded-2xl text-[13px] font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white text-black font-bold shadow-lg'
                        : 'bg-white/10 text-white/80 hover:bg-white/15'
                    }`}
                  >
                    {mins ? `${mins} Mins` : 'Turn Off'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* C. More Options Bottom Sheet */}
      {showMenuModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-md mx-auto liquid-glass rounded-t-[32px] p-5 shadow-2xl border-t border-white/10 max-h-[85vh] overflow-y-auto">
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-black/50 shrink-0 border border-white/10">
                  <TrackImage src={currentTrack.coverUrl} videoId={currentTrack.videoId} alt={currentTrack.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[15px] font-bold text-white truncate">{currentTrack.title}</span>
                  <span className="text-[12px] text-white/70 truncate">{currentTrack.artist}</span>
                </div>
              </div>
              <button
                onClick={() => setShowMenuModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:text-white cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined floating-icon text-[18px]">close</span>
              </button>
            </div>

            {/* Menu Actions */}
            <div className="mt-4 flex flex-col gap-2">
              {/* Up Next Queue */}
              <button
                onClick={() => {
                  setShowMenuModal(false);
                  setShowQueue(true);
                }}
                className="flex items-center gap-3 w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined floating-icon text-[20px]">queue_music</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-semibold">View Up Next Queue</span>
                  <span className="text-[11px] text-white/60">{queue.length} track{queue.length === 1 ? '' : 's'} queued • Drag, reorder & infinite radio</span>
                </div>
              </button>

              {/* Play Next */}
              <button
                onClick={() => {
                  if (onPlayNext) {
                    onPlayNext(currentTrack);
                    setToastMessage(`Queued to play next`);
                    setTimeout(() => setToastMessage(null), 2000);
                  }
                  setShowMenuModal(false);
                }}
                className="flex items-center gap-3 w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined floating-icon text-[20px]">playlist_play</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-semibold">Play Next</span>
                  <span className="text-[11px] text-white/60">Insert this track at top of Up Next</span>
                </div>
              </button>

              {/* Add to Queue */}
              <button
                onClick={() => {
                  if (onAddToQueue) {
                    onAddToQueue(currentTrack);
                    setToastMessage(`Added to queue`);
                    setTimeout(() => setToastMessage(null), 2000);
                  }
                  setShowMenuModal(false);
                }}
                className="flex items-center gap-3 w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined floating-icon text-[20px]">playlist_add</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-semibold">Add to Queue</span>
                  <span className="text-[11px] text-white/60">Append to end of playback queue</span>
                </div>
              </button>

              {/* Download for Offline Listening */}
              <button
                id="modal-download-toggle-btn"
                onClick={() => {
                  const nowDownloaded = offlineService.toggleDownload(currentTrack);
                  setToastMessage(nowDownloaded ? 'Downloaded for offline playback' : 'Removed from downloads');
                  setTimeout(() => setToastMessage(null), 2200);
                  setShowMenuModal(false);
                }}
                className="flex items-center gap-3 w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer text-left"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  offlineService.isDownloaded(currentTrack.id) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white'
                }`}>
                  <span className="material-symbols-outlined floating-icon text-[20px]">
                    {offlineService.isDownloaded(currentTrack.id) ? 'check_circle' : 'download'}
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-semibold">
                    {offlineService.isDownloaded(currentTrack.id) ? 'Downloaded Offline' : 'Download Song'}
                  </span>
                  <span className="text-[11px] text-white/60">
                    {offlineService.isDownloaded(currentTrack.id) ? 'Cached locally for offline playback' : 'Save high-res audio to device storage'}
                  </span>
                </div>
              </button>

              {/* Share */}
              <button
                onClick={() => {
                  handleShare();
                  setShowMenuModal(false);
                }}
                className="flex items-center gap-3 w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined floating-icon text-[20px]">share</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-semibold">Share Track</span>
                  <span className="text-[11px] text-white/60">Copy song link or share with friends</span>
                </div>
              </button>

              {/* Equalizer Sound Presets */}
              <div className="p-3 rounded-2xl bg-white/5 flex flex-col gap-2">
                <div
                  onClick={() => setShowEqSubModal(!showEqSubModal)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                      <span className="material-symbols-outlined floating-icon text-[20px]">graphic_eq</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[14px] font-semibold text-white">Audio Equalizer</span>
                      <span className="text-[11px] text-white/70">{settings.equalizerPreset}</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined floating-icon text-[20px] text-white/60">
                    {showEqSubModal ? 'expand_less' : 'expand_more'}
                  </span>
                </div>

                {showEqSubModal && (
                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/10">
                    {eqPresets.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          onUpdateSettings({ equalizerPreset: preset });
                          setToastMessage(`Preset: ${preset}`);
                          setTimeout(() => setToastMessage(null), 2000);
                        }}
                        className={`px-3 py-2 rounded-xl text-[12px] font-medium text-left truncate transition-colors ${
                          settings.equalizerPreset === preset
                            ? 'bg-white text-black font-bold'
                            : 'bg-white/10 text-white/80 hover:bg-white/15'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Hi-Res Lossless Audio Badge */}
              <div className="p-3 rounded-2xl bg-white/5 flex items-center justify-between text-[12px]">
                <div className="flex flex-col">
                  <span className="text-[11px] text-white/60 uppercase font-bold tracking-wider">Audio Quality</span>
                  <span className="text-white font-semibold mt-0.5">320kbps High Fidelity Stream</span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] uppercase tracking-wider border border-emerald-500/30">
                  Hi-Res Direct
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
