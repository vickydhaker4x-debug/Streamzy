import React, { useState, useEffect } from 'react';
import { Track } from '../types';
import { audioFocusService, AudioFocusState } from '../services/audioFocusService';
import { persistentBackgroundService } from '../services/persistentBackgroundService';
import { audioEngine } from '../utils/audioPlayer';

interface OsMediaSessionTesterProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTimeSec: number;
  durationSec: number;
  isFavorite: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onToggleFavorite: (trackId: string) => void;
  onSeek: (seconds: number) => void;
  onClose?: () => void;
}

export const OsMediaSessionTester: React.FC<OsMediaSessionTesterProps> = ({
  currentTrack,
  isPlaying,
  currentTimeSec,
  durationSec,
  isFavorite,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onToggleFavorite,
  onSeek,
  onClose
}) => {
  const [audioFocusState, setAudioFocusState] = useState<AudioFocusState>('gain');
  const [focusReason, setFocusReason] = useState<string>('Normal Playback');
  const [volumeMult, setVolumeMult] = useState<number>(1.0);
  const [isSimulatingCall, setIsSimulatingCall] = useState<boolean>(false);
  const [isSimulatingGps, setIsSimulatingGps] = useState<boolean>(false);
  const [screenOffMode, setScreenOffMode] = useState<boolean>(false);

  useEffect(() => {
    const unsub = audioFocusService.subscribe((evt) => {
      setAudioFocusState(evt.state);
      setFocusReason(evt.reason);
      setVolumeMult(evt.volumeMultiplier);
    });
    return unsub;
  }, []);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSimulateCall = () => {
    if (isSimulatingCall) {
      // End call
      setIsSimulatingCall(false);
      audioFocusService.handleInterruptionEnded();
    } else {
      // Start incoming call
      setIsSimulatingCall(true);
      audioFocusService.handleIncomingInterruption(isPlaying);
    }
  };

  const handleSimulateGps = () => {
    setIsSimulatingGps(true);
    audioFocusService.duckAudio(3500);
    setTimeout(() => {
      setIsSimulatingGps(false);
    }, 3500);
  };

  const handleSimulateUnplug = () => {
    audioFocusService.handleHeadphonesDisconnected();
  };

  return (
    <div className="flex flex-col gap-4 text-[#e4e1e7]">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/30 flex items-center justify-center text-[var(--color-primary)]">
            <span className="material-symbols-outlined text-[18px]">notifications_active</span>
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-white leading-tight">OS Media Notification & Lockscreen</h3>
            <p className="text-[11px] text-[#a1a1aa]">Android 14+ Foreground Service • W3C MediaSession • Audio Focus</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-zinc-300 active:scale-95 transition"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>

      {/* Simulated Lockscreen / Notification Card */}
      <div className="rounded-2xl p-4 bg-gradient-to-b from-[#222129] to-[#15141a] border border-white/10 shadow-2xl flex flex-col gap-3.5 relative overflow-hidden">
        {/* Top bar with app badge & Foreground status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-md bg-[var(--color-primary)] flex items-center justify-center">
              <span className="material-symbols-outlined text-[10px] text-zinc-950 font-black">music_note</span>
            </div>
            <span className="text-[11px] font-semibold text-zinc-300">Streamzy</span>
            <span className="text-[10px] text-zinc-500">•</span>
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Foreground Service Active
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 font-mono border border-white/5">
            WAKE_LOCK HELD
          </span>
        </div>

        {/* Media Notification Main Content */}
        <div className="flex items-center gap-3.5">
          {currentTrack?.coverUrl ? (
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className="w-16 h-16 rounded-xl object-cover shadow-md border border-white/10 shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-zinc-500 text-[24px]">album</span>
            </div>
          )}

          <div className="flex flex-col min-w-0 flex-1">
            <h4 className="text-[14px] font-bold text-white truncate leading-tight">
              {currentTrack?.title || 'No active track'}
            </h4>
            <p className="text-[12px] text-zinc-400 truncate mt-0.5">
              {currentTrack?.artist || 'Select a song to start'}
            </p>
            <p className="text-[10px] text-zinc-500 truncate mt-0.5">
              {currentTrack?.album || 'Streamzy Master Audio'}
            </p>
          </div>

          {/* Favorite toggle on notification */}
          {currentTrack && (
            <button
              onClick={() => onToggleFavorite(currentTrack.id)}
              className="p-2 text-zinc-400 hover:text-[var(--color-primary)] active:scale-90 transition shrink-0"
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <span
                className={`material-symbols-outlined text-[22px] ${
                  isFavorite ? 'text-[var(--color-primary)] fill-1 font-variation-settings-fill' : ''
                }`}
              >
                {isFavorite ? 'favorite' : 'favorite_border'}
              </span>
            </button>
          )}
        </div>

        {/* Lockscreen Progress Bar */}
        <div className="flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={durationSec || 100}
            value={currentTimeSec}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
          />
          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
            <span>{formatTime(currentTimeSec)}</span>
            <span>{formatTime(durationSec)}</span>
          </div>
        </div>

        {/* Lockscreen Control Buttons */}
        <div className="flex items-center justify-center gap-6 pt-1">
          <button
            onClick={onPrevTrack}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-zinc-200 active:scale-90 transition"
            title="Previous track"
          >
            <span className="material-symbols-outlined text-[24px]">skip_previous</span>
          </button>

          <button
            onClick={onTogglePlay}
            className="w-12 h-12 rounded-full bg-[var(--color-primary)] text-zinc-950 flex items-center justify-center font-bold shadow-lg active:scale-95 transition hover:brightness-110"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <span className="material-symbols-outlined text-[28px]">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          <button
            onClick={onNextTrack}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-zinc-200 active:scale-90 transition"
            title="Next track"
          >
            <span className="material-symbols-outlined text-[24px]">skip_next</span>
          </button>
        </div>
      </div>

      {/* Audio Focus Interruption & Ducking Suite */}
      <div className="liquid-glass rounded-2xl p-4 flex flex-col gap-3 border border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-amber-400">hearing</span>
            <span className="text-[13px] font-bold text-white">Audio Focus & Interruption Manager</span>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
              audioFocusState === 'gain'
                ? 'bg-emerald-500/20 text-emerald-300'
                : audioFocusState === 'duck'
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {audioFocusState === 'gain'
              ? 'Focus: Granted (100%)'
              : audioFocusState === 'duck'
              ? `Ducked (${Math.round(volumeMult * 100)}%)`
              : 'Interrupted / Paused'}
          </span>
        </div>

        <p className="text-[12px] text-zinc-400 leading-relaxed">
          Status: <strong className="text-zinc-200">{focusReason}</strong>
        </p>

        {/* Interruption Simulation Triggers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {/* 1. Phone Call Interruption */}
          <button
            onClick={handleSimulateCall}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 ${
              isSimulatingCall
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-white/10 hover:bg-white/15 text-zinc-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isSimulatingCall ? 'call_end' : 'call'}
            </span>
            <span>{isSimulatingCall ? 'End Call (Auto-Resume)' : 'Simulate Call'}</span>
          </button>

          {/* 2. GPS Audio Ducking */}
          <button
            onClick={handleSimulateGps}
            disabled={isSimulatingGps}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 ${
              isSimulatingGps
                ? 'bg-amber-500 text-zinc-950 font-bold'
                : 'bg-white/10 hover:bg-white/15 text-zinc-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">navigation</span>
            <span>{isSimulatingGps ? 'Ducking 20%...' : 'Simulate GPS Prompt'}</span>
          </button>

          {/* 3. Headphone Unplug */}
          <button
            onClick={handleSimulateUnplug}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-zinc-200 flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">headphones</span>
            <span>Unplug Headphones</span>
          </button>
        </div>
      </div>

      {/* Screen-Off / Background Playback Integrity Check */}
      <div className="liquid-glass rounded-2xl p-4 flex items-center justify-between gap-3 border border-white/[0.06]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-[var(--color-primary)] shrink-0">
            <span className="material-symbols-outlined text-[20px]">screen_lock_portrait</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] text-white font-semibold leading-snug">Screen-Off Keep-Alive Engine</span>
            <span className="text-[11px] text-[#a1a1aa] truncate">
              {screenOffMode
                ? 'Simulating screen locked: Inaudible hardware audio thread active'
                : 'WakeLock & Background Audio Session Active'}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            const next = !screenOffMode;
            setScreenOffMode(next);
            if (next) {
              persistentBackgroundService.reinforceSession();
            }
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 ${
            screenOffMode
              ? 'bg-emerald-500 text-zinc-950 font-bold'
              : 'bg-white/10 hover:bg-white/15 text-zinc-200'
          }`}
        >
          {screenOffMode ? 'Screen Locked (Active)' : 'Test Lockscreen'}
        </button>
      </div>
    </div>
  );
};
