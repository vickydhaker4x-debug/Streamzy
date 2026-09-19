import React, { useState, useRef, useMemo } from 'react';
import { Track } from '../types';
import { TrackImage } from './TrackImage';
import { historyService } from '../services/historyService';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track;
  queue: Track[];
  onPlayFromQueue: (track: Track, index: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onReorderQueue: (startIndex: number, endIndex: number) => void;
  onPlayNext: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onClearQueue: () => void;
  onShuffleQueue: () => void;
  isInfiniteAutoPlay: boolean;
  onToggleInfiniteAutoPlay: () => void;
  radioTracks: Track[];
  currentVibe?: string;
  onSelectTrack: (track: Track) => void;
  onSaveQueueAsPlaylist?: (name: string) => void;
  onToggleFavorite?: (trackId: string) => void;
  favoriteTrackIds?: Set<string>;
  onPrioritizeQueue?: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onClose,
  currentTrack,
  queue,
  onPlayFromQueue,
  onRemoveFromQueue,
  onReorderQueue,
  onPlayNext,
  onAddToQueue,
  onClearQueue,
  onShuffleQueue,
  onPrioritizeQueue,
  isInfiniteAutoPlay,
  onToggleInfiniteAutoPlay,
  radioTracks,
  currentVibe,
  onSelectTrack,
  onSaveQueueAsPlaylist,
  onToggleFavorite,
  favoriteTrackIds
}) => {
  // Tabs: 'queue' (Up Next), 'radio' (Similar / Autoplay), 'history' (Past Songs)
  const [activeTab, setActiveTab] = useState<'queue' | 'radio' | 'history'>('queue');
  const [isSavingPlaylist, setIsSavingPlaylist] = useState(false);
  const [playlistNameInput, setPlaylistNameInput] = useState('');
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Drag and drop reordering state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Mobile Touch swipe state
  const [swipingIndex, setSwipingIndex] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const touchStartXRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);

  // Retrieve past history tracks
  const historyTracks = useMemo(() => {
    return historyService.getHistoryTracks().filter((t) => t.id !== currentTrack?.id);
  }, [currentTrack, isOpen]);

  // Total formatted queue duration
  const totalQueueDuration = useMemo(() => {
    const totalSec = queue.reduce((acc, t) => acc + (t.durationSec || 210), 0);
    const mins = Math.floor(totalSec / 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours} hr ${remainingMins} min`;
    }
    return `${mins} min`;
  }, [queue]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2200);
  };

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    touchStartXRef.current = e.touches[0].clientX;
    isSwipingRef.current = true;
    setSwipingIndex(index);
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent, index: number) => {
    if (!isSwipingRef.current || swipingIndex !== index) return;
    const diff = e.touches[0].clientX - touchStartXRef.current;
    if (diff < 0) {
      setSwipeOffset(Math.max(-120, diff));
    } else {
      setSwipeOffset(0);
    }
  };

  const handleTouchEnd = (_e: React.TouchEvent, index: number) => {
    if (!isSwipingRef.current || swipingIndex !== index) return;
    isSwipingRef.current = false;
    if (swipeOffset < -70) {
      const removedTitle = queue[index]?.title || 'Track';
      onRemoveFromQueue(index);
      showToast(`Removed "${removedTitle}" from queue`);
    }
    setSwipingIndex(null);
    setSwipeOffset(0);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      onReorderQueue(draggedIndex, targetIndex);
      showToast('Queue reordered');
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleMoveToTop = (index: number) => {
    if (index > 0) {
      onReorderQueue(index, 0);
      showToast('Moved track to top of queue');
    }
    setActiveMenuIndex(null);
  };

  const handleMoveToBottom = (index: number) => {
    if (index < queue.length - 1) {
      onReorderQueue(index, queue.length - 1);
      showToast('Moved track to bottom of queue');
    }
    setActiveMenuIndex(null);
  };

  return (
    <div
      id="bloomee-queue-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex flex-col justify-end animate-in fade-in duration-200"
      onClick={() => {
        setActiveMenuIndex(null);
        onClose();
      }}
    >
      {/* Toast Overlay */}
      {toastMsg && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-zinc-900/95 border border-white/20 text-white text-[12px] font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-[16px] text-[#FE385E]">check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      <div
        id="bloomee-queue-sheet"
        onClick={(e) => {
          e.stopPropagation();
          setActiveMenuIndex(null);
        }}
        className="w-full max-w-xl mx-auto bg-[#120D15]/95 backdrop-blur-2xl rounded-t-[32px] max-h-[88vh] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.8)] border-t border-white/[0.12] overflow-hidden"
      >
        {/* Top Handle */}
        <div className="w-full flex items-center justify-center pt-3 pb-1.5 shrink-0 cursor-grab">
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Bloomee Queue Main Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-white/[0.08] shrink-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FE385E] text-[22px]">
                queue_music
              </span>
              <h2 className="font-extrabold text-[17px] text-white tracking-tight">
                Playing Queue
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[#FE385E]/20 text-[#FE385E] font-mono text-[11px] font-bold">
                {queue.length}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
              <span>{queue.length} tracks • {totalQueueDuration}</span>
              {currentVibe && (
                <>
                  <span>•</span>
                  <span className="text-[#FE385E] font-semibold truncate max-w-[140px]">
                    {currentVibe}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center gap-1.5">
            {/* Prioritize Queue Button */}
            {queue.length > 1 && onPrioritizeQueue && (
              <button
                id="queue-prioritize-btn"
                title="Prioritize Queue: 1. Singer • 2. Genre • 3. Language"
                onClick={() => {
                  onPrioritizeQueue();
                  showToast('Queue Prioritized: 1. Singer • 2. Genre • 3. Language');
                }}
                className="px-2.5 py-1 rounded-full bg-[#FE385E]/20 hover:bg-[#FE385E]/30 text-[#FE385E] border border-[#FE385E]/30 active:scale-95 flex items-center gap-1 text-[11px] font-bold transition cursor-pointer streamzy-glow-subtle"
              >
                <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                <span>Prioritize</span>
              </button>
            )}

            {/* Save as Playlist */}
            {queue.length > 0 && onSaveQueueAsPlaylist && (
              <button
                id="queue-save-btn"
                title="Save queue as playlist"
                onClick={() => {
                  setPlaylistNameInput(`Queue Mix - ${new Date().toLocaleDateString()}`);
                  setIsSavingPlaylist(true);
                }}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] active:scale-90 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">playlist_add</span>
              </button>
            )}

            {/* Shuffle Queue */}
            {queue.length > 1 && (
              <button
                id="queue-shuffle-btn"
                title="Shuffle queue"
                onClick={() => {
                  onShuffleQueue();
                  showToast('Queue shuffled');
                }}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] active:scale-90 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">shuffle</span>
              </button>
            )}

            {/* Clear Queue */}
            {queue.length > 0 && (
              <button
                id="queue-clear-btn"
                title="Clear queue"
                onClick={() => {
                  onClearQueue();
                  showToast('Queue cleared');
                }}
                className="px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-red-500/20 active:scale-90 text-[11px] font-semibold text-zinc-300 hover:text-red-400 transition cursor-pointer"
              >
                Clear
              </button>
            )}

            {/* Close Button */}
            <button
              id="queue-close-btn"
              aria-label="Close queue"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.16] active:scale-90 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer ml-1"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Inline Save Playlist Form */}
        {isSavingPlaylist && onSaveQueueAsPlaylist && (
          <div className="px-5 py-3 bg-[#1A1220] border-b border-white/10 flex items-center gap-2 animate-in fade-in">
            <input
              type="text"
              value={playlistNameInput}
              onChange={(e) => setPlaylistNameInput(e.target.value)}
              placeholder="Enter playlist name..."
              className="flex-1 px-3 py-1.5 rounded-xl bg-black/50 border border-white/15 text-white text-[13px] outline-none focus:border-[#FE385E]"
              autoFocus
            />
            <button
              onClick={() => {
                if (playlistNameInput.trim()) {
                  onSaveQueueAsPlaylist(playlistNameInput.trim());
                  setIsSavingPlaylist(false);
                  showToast(`Saved playlist "${playlistNameInput.trim()}"`);
                }
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#FE385E] text-white font-bold text-[12px] cursor-pointer hover:brightness-110 active:scale-95 transition"
            >
              Save
            </button>
            <button
              onClick={() => setIsSavingPlaylist(false)}
              className="px-2.5 py-1.5 text-zinc-400 hover:text-white text-[12px] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Bloomee 3-Way Segmented Tabs */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between gap-2 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-2xl border border-white/[0.06]">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'queue'
                  ? 'bg-[#FE385E] text-white shadow-[0_2px_12px_rgba(254,56,94,0.4)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">list</span>
              <span>Up Next ({queue.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('radio')}
              className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'radio'
                  ? 'bg-[#FE385E] text-white shadow-[0_2px_12px_rgba(254,56,94,0.4)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">radio</span>
              <span>Similar & Radio</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-[#FE385E] text-white shadow-[0_2px_12px_rgba(254,56,94,0.4)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">history</span>
              <span>History</span>
            </button>
          </div>

          {/* Infinite Autoplay Switch */}
          <button
            onClick={() => {
              onToggleInfiniteAutoPlay();
              showToast(!isInfiniteAutoPlay ? 'Autoplay Radio turned ON' : 'Autoplay Radio turned OFF');
            }}
            title="Autoplay similar songs continuously"
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
              isInfiniteAutoPlay
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isInfiniteAutoPlay ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
            <span>Autoplay</span>
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="overflow-y-auto px-4 py-3 space-y-4 flex-1 no-scrollbar">

          {/* Now Playing Banner (Always displayed at top for reference) */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#FE385E] px-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FE385E] animate-ping" />
              Now Playing
            </span>

            <div className="p-3 rounded-2xl bg-[#1C1322] border border-[#FE385E]/20 flex items-center justify-between shadow-lg relative overflow-hidden group">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black/60 shadow-md">
                  <TrackImage
                    src={currentTrack.coverUrl}
                    videoId={currentTrack.videoId}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Equalizer Waveform Overlay */}
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center gap-0.5">
                    <span className="w-0.5 h-3.5 bg-[#FE385E] rounded-full animate-bounce" />
                    <span className="w-0.5 h-5 bg-[#FE385E] rounded-full animate-pulse" />
                    <span className="w-0.5 h-2.5 bg-[#FE385E] rounded-full animate-bounce" />
                  </div>
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-bold text-white truncate group-hover:text-[#FE385E] transition">
                    {currentTrack.title}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11.5px] text-zinc-400 truncate mt-0.5">
                    <span>{currentTrack.artist}</span>
                    {currentTrack.album && (
                      <>
                        <span>•</span>
                        <span className="truncate">{currentTrack.album}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 pl-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-300 font-mono uppercase">
                  320k
                </span>
                {onToggleFavorite && (
                  <button
                    onClick={() => onToggleFavorite(currentTrack.id)}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-90 transition cursor-pointer"
                  >
                    <span className={`material-symbols-outlined text-[18px] ${
                      favoriteTrackIds?.has(currentTrack.id) || currentTrack.isFavorite
                        ? 'text-[#FE385E] fill-current'
                        : 'text-zinc-400'
                    }`}>
                      favorite
                    </span>
                  </button>
                )}
                <span className="text-[12px] text-zinc-400 font-mono">
                  {currentTrack.duration}
                </span>
              </div>
            </div>
          </div>

          {/* TAB 1: UP NEXT QUEUE */}
          {activeTab === 'queue' && (
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Upcoming Tracks ({queue.length})
                </span>
                <span className="text-[10.5px] text-zinc-500">
                  Drag ☰ to reorder • Swipe left to delete
                </span>
              </div>

              {queue.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center flex flex-col items-center justify-center space-y-2 text-zinc-400">
                  <span className="material-symbols-outlined text-[32px] text-zinc-600">
                    queue_music
                  </span>
                  <p className="text-[13px] font-medium text-zinc-300">
                    Your playback queue is empty
                  </p>
                  <p className="text-[11.5px] text-zinc-500 max-w-xs">
                    {isInfiniteAutoPlay
                      ? 'Autoplay is active and will generate seamless contextual music when current song completes.'
                      : 'Add songs or switch to the Similar tab to queue recommendations.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {queue.map((track, idx) => {
                    const isSwiped = swipingIndex === idx;
                    const isOver = dragOverIndex === idx;
                    const isDragging = draggedIndex === idx;
                    const isMenuOpen = activeMenuIndex === idx;

                    return (
                      <div
                        key={`${track.id}-${idx}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        onTouchStart={(e) => handleTouchStart(e, idx)}
                        onTouchMove={(e) => handleTouchMove(e, idx)}
                        onTouchEnd={(e) => handleTouchEnd(e, idx)}
                        className={`relative rounded-2xl overflow-hidden transition-all duration-150 ${
                          isOver ? 'border-2 border-[#FE385E] scale-[1.01]' : 'border border-white/[0.06]'
                        } ${isDragging ? 'opacity-30' : 'opacity-100'}`}
                      >
                        {/* Swipe Delete Reveal Background */}
                        <div className="absolute inset-0 bg-red-600/90 flex items-center justify-end px-5 text-white font-bold text-[12px] gap-1 z-0">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                          <span>Delete</span>
                        </div>

                        {/* Foreground Card */}
                        <div
                          style={{
                            transform: isSwiped ? `translateX(${swipeOffset}px)` : 'translateX(0px)',
                            transition: isSwiped ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
                          }}
                          className="relative z-10 p-2.5 bg-[#17101C] hover:bg-[#201426] flex items-center justify-between gap-2.5 cursor-pointer select-none"
                          onClick={() => {
                            setActiveMenuIndex(null);
                            onPlayFromQueue(track, idx);
                          }}
                        >
                          {/* Left: Drag Handle + Index + Artwork + Meta */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Drag Handle */}
                            <button
                              type="button"
                              className="w-5 h-7 flex items-center justify-center text-zinc-500 hover:text-white cursor-grab active:cursor-grabbing shrink-0"
                              onClick={(e) => e.stopPropagation()}
                              title="Drag to reorder"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                drag_indicator
                              </span>
                            </button>

                            {/* Position Index */}
                            <span className="text-[11px] font-mono font-bold text-zinc-500 w-4 text-center shrink-0">
                              {idx + 1}
                            </span>

                            {/* Album Artwork */}
                            <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-black/60 shrink-0 shadow">
                              <TrackImage
                                src={track.coverUrl}
                                videoId={track.videoId}
                                alt={track.title}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {/* Track Metadata */}
                            <div className="flex flex-col min-w-0">
                              <span className="text-[13px] font-bold text-white truncate">
                                {track.title}
                              </span>
                              <span className="text-[11.5px] text-zinc-400 truncate mt-0.5">
                                {track.artist} {track.album ? `• ${track.album}` : ''}
                              </span>
                            </div>
                          </div>

                          {/* Right Controls */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[11.5px] text-zinc-400 font-mono pr-1">
                              {track.duration}
                            </span>

                            {/* Play Next Button */}
                            <button
                              onClick={() => {
                                onPlayNext(track);
                                showToast(`"${track.title}" set to play next`);
                              }}
                              title="Play Next"
                              className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.14] active:scale-90 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[15px]">playlist_play</span>
                            </button>

                            {/* More Options Dropdown Toggle */}
                            <div className="relative">
                              <button
                                onClick={() => setActiveMenuIndex(isMenuOpen ? null : idx)}
                                title="Track options"
                                className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.14] active:scale-90 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px]">more_vert</span>
                              </button>

                              {/* Dropdown Menu */}
                              {isMenuOpen && (
                                <div className="absolute right-0 top-8 z-30 w-44 rounded-2xl bg-[#1D1424] border border-white/15 shadow-2xl py-1.5 text-[12px] font-medium text-zinc-200 animate-in fade-in zoom-in-95">
                                  <button
                                    onClick={() => handleMoveToTop(idx)}
                                    className="w-full px-3.5 py-2 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[16px] text-zinc-400">vertical_align_top</span>
                                    <span>Move to Top</span>
                                  </button>

                                  <button
                                    onClick={() => handleMoveToBottom(idx)}
                                    className="w-full px-3.5 py-2 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[16px] text-zinc-400">vertical_align_bottom</span>
                                    <span>Move to Bottom</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      onPlayNext(track);
                                      setActiveMenuIndex(null);
                                      showToast(`Set "${track.title}" to play next`);
                                    }}
                                    className="w-full px-3.5 py-2 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[16px] text-zinc-400">playlist_play</span>
                                    <span>Play Next</span>
                                  </button>

                                  <div className="h-px bg-white/10 my-1" />

                                  <button
                                    onClick={() => {
                                      onRemoveFromQueue(idx);
                                      setActiveMenuIndex(null);
                                      showToast(`Removed from queue`);
                                    }}
                                    className="w-full px-3.5 py-2 text-left hover:bg-red-500/20 text-red-400 flex items-center gap-2 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                    <span>Remove from Queue</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SIMILAR & RADIO TRACKS */}
          {activeTab === 'radio' && (
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Similar Tracks to {currentTrack.title}
                </span>
                <span className="text-[11px] text-[#FE385E] font-semibold">
                  Infinite Stream
                </span>
              </div>

              {radioTracks.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center text-zinc-400">
                  <p className="text-[13px]">Generating contextual music matches...</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {radioTracks.map((track, idx) => (
                    <div
                      key={`radio-${track.id}-${idx}`}
                      onClick={() => onSelectTrack(track)}
                      className="p-2.5 rounded-2xl bg-[#17101C] hover:bg-[#221528] border border-white/[0.06] flex items-center justify-between gap-3 cursor-pointer transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-black/60 shrink-0">
                          <TrackImage
                            src={track.coverUrl}
                            videoId={track.videoId}
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <span className="material-symbols-outlined text-white text-[20px]">
                              play_arrow
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-bold text-white truncate group-hover:text-[#FE385E] transition">
                            {track.title}
                          </span>
                          <span className="text-[11.5px] text-zinc-400 truncate mt-0.5">
                            {track.artist}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[11.5px] text-zinc-400 font-mono pr-1">
                          {track.duration}
                        </span>

                        <button
                          onClick={() => {
                            onAddToQueue(track);
                            showToast(`Added "${track.title}" to queue`);
                          }}
                          title="Add to queue"
                          className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.14] active:scale-90 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PLAYBACK HISTORY */}
          {activeTab === 'history' && (
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Recently Played ({historyTracks.length})
                </span>
                {historyTracks.length > 0 && (
                  <button
                    onClick={() => {
                      historyTracks.forEach((t) => onAddToQueue(t));
                      showToast(`Added ${historyTracks.length} past tracks to queue`);
                    }}
                    className="text-[11px] font-semibold text-[#FE385E] hover:underline cursor-pointer"
                  >
                    Add All to Queue
                  </button>
                )}
              </div>

              {historyTracks.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center text-zinc-400">
                  <p className="text-[13px]">No past playback history yet</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {historyTracks.slice(0, 30).map((track, idx) => (
                    <div
                      key={`hist-${track.id}-${idx}`}
                      onClick={() => onSelectTrack(track)}
                      className="p-2.5 rounded-2xl bg-[#17101C] hover:bg-[#221528] border border-white/[0.06] flex items-center justify-between gap-3 cursor-pointer transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-black/60 shrink-0">
                          <TrackImage
                            src={track.coverUrl}
                            videoId={track.videoId}
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-bold text-white truncate group-hover:text-[#FE385E] transition">
                            {track.title}
                          </span>
                          <span className="text-[11.5px] text-zinc-400 truncate mt-0.5">
                            {track.artist}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            onAddToQueue(track);
                            showToast(`Added "${track.title}" to queue`);
                          }}
                          title="Add to queue"
                          className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.14] active:scale-90 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
