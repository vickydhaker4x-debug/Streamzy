import React, { useState, useEffect } from 'react';
import { SettingsState, AccentColor, StreamingProtocol, Track } from '../types';
import { VD_MUSIC_LOGO_URL } from '../data/musicData';
import { adaptiveBitrateService } from '../services/adaptiveBitrateService';
import { offlineService } from '../services/offlineService';

interface SettingsScreenProps {
  settings: SettingsState;
  onUpdateSettings: (newSettings: Partial<SettingsState>) => void;
  onBack: () => void;
  onOpenEqualizer: () => void;
  currentTrack?: Track | null;
  isPlaying?: boolean;
  currentTimeSec?: number;
  onTogglePlay?: () => void;
  onNextTrack?: () => void;
  onPrevTrack?: () => void;
  onToggleFavorite?: (id: string) => void;
  onSeek?: (sec: number) => void;
}

const APP_VERSION = 'v3.0.5';
const GITHUB_REPO = 'vickydhaker4x/VD-Music'; // Update this if your repo name is different

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onBack,
  onOpenEqualizer,
  currentTrack,
  isPlaying = false,
  currentTimeSec = 0,
  onTogglePlay = () => {},
  onNextTrack = () => {},
  onPrevTrack = () => {},
  onToggleFavorite = () => {},
  onSeek = () => {}
}) => {
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState(`Up to date • Release Build ${APP_VERSION}`);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  
  const [cacheCleared, setCacheCleared] = useState(false);
  const [isQualityModalOpen, setIsQualityModalOpen] = useState(false);
  const [isInstanceModalOpen, setIsInstanceModalOpen] = useState(false);
  const [settingToast, setSettingToast] = useState<string | null>(null);

  useEffect(() => {
    // Check for updates silently on mount
    checkForUpdates(true);
  }, []);

  const checkForUpdates = async (silent = false) => {
    if (!silent) setCheckingUpdate(true);
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
      
      // If the repo doesn't exist, is private, or has no releases yet, GitHub returns 404.
      if (res.status === 404) {
        if (!silent) {
          setUpdateMessage(`Streamzy ${APP_VERSION} is up to date!`);
        }
        if (!silent) setCheckingUpdate(false);
        return;
      }
      
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      
      const latestVersion = data.tag_name;
      // Simple string comparison for versions (v3.0.5 vs v3.0.6)
      if (latestVersion && latestVersion !== APP_VERSION && latestVersion > APP_VERSION) {
        setUpdateMessage(`New update available: ${latestVersion}`);
        // Find APK asset
        const apkAsset = data.assets?.find((a: any) => a.name.endsWith('.apk'));
        if (apkAsset) {
          setUpdateAvailable(apkAsset.browser_download_url);
        } else {
          setUpdateAvailable(data.html_url); // Fallback to release page
        }
      } else {
        if (!silent) {
          setUpdateMessage(`Streamzy ${APP_VERSION} is up to date!`);
        }
      }
    } catch (err) {
      if (!silent) {
        setUpdateMessage(`Streamzy ${APP_VERSION} is up to date!`); // Fallback gracefully instead of showing an error
      }
    }
    if (!silent) setCheckingUpdate(false);
  };

  const handleUpdateClick = () => {
    if (updateAvailable) {
      window.open(updateAvailable, '_blank');
    } else {
      checkForUpdates(false);
    }
  };

  const triggerToast = (msg: string) => {
    setSettingToast(msg);
    setTimeout(() => {
      setSettingToast((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  const [, setStorageTick] = useState(0);
  useEffect(() => {
    const unsub = offlineService.subscribe(() => setStorageTick((t) => t + 1));
    return unsub;
  }, []);

  const storage = offlineService.getStorageBreakdown();

  const handleClearCache = () => {
    offlineService.clearAllDownloads();
    try {
      localStorage.removeItem('vd_art_cache_v2');
    } catch {}
    setCacheCleared(true);
    triggerToast('Audio cache and offline downloads cleared successfully');
    setTimeout(() => {
      setCacheCleared(false);
    }, 2500);
  };

  const accentColors: { id: AccentColor; hex: string; name: string }[] = [
    { id: 'coral', hex: '#f87171', name: 'Coral Pink' },
    { id: 'orange', hex: '#fb923c', name: 'Sunset Orange' },
    { id: 'cyan', hex: '#38bdf8', name: 'Cyan Mist' },
    { id: 'emerald', hex: '#34d399', name: 'Emerald' },
    { id: 'purple', hex: '#c084fc', name: 'Lavender' }
  ];

  return (
    <div id="settings-screen-view" className="flex flex-col w-full px-4 sm:px-6 gap-5 pb-28 max-w-2xl mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <button 
            id="settings-back-btn"
            aria-label="Navigate Back"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/[0.05] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/10 flex items-center justify-center text-[#e4e1e7] hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)] hover:scale-105 transition-colors active:scale-95 shadow-sm cursor-pointer floating-btn"
          >
            <span className="material-symbols-outlined floating-icon text-[20px]">arrow_back</span>
          </button>
          <span className="text-[22px] font-bold text-[#e4e1e7] tracking-tight">
            Settings
          </span>
        </div>
      </div>

      {/* App Info Card */}
      <div className="relative overflow-hidden liquid-glass rounded-2xl p-4 flex items-center justify-between shadow-sm border border-white/[0.04]">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative w-12 h-12 rounded-2xl overflow-hidden shadow-md shrink-0 border border-white/10 bg-black">
            <img 
              src="/streamzy_logo.jpg" 
              alt="Streamzy" 
              className="w-full h-full object-cover rounded-[14px]"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-extrabold text-[#e4e1e7] tracking-tight">
                Stream<span className="bg-gradient-to-r from-[#D946EF] via-[#A855F7] to-[#06B6D4] bg-clip-text text-transparent">zy</span>
              </span>
              <span className="text-[10px] font-bold liquid-glass text-[var(--color-primary)] px-2 py-0.5 rounded-full border border-white/[0.05]">
                v3.0.5
              </span>
            </div>
            <span className="text-[12px] text-[#a1a1aa] truncate mt-0.5">
              {updateMessage}
            </span>
          </div>
        </div>

        <button 
          id="check-update-btn"
          onClick={handleUpdateClick}
          disabled={checkingUpdate}
          className="relative px-3.5 py-1.5 rounded-xl liquid-glass text-[#e4e1e7] text-[12px] font-semibold flex items-center gap-1 shrink-0 hover:bg-white/[0.2] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)] transition-all duration-300 active:scale-95 cursor-pointer border border-white/[0.04]"
        >
          {updateAvailable && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#1b1b1f] z-10 animate-pulse" />
          )}
          <span className={`material-symbols-outlined text-[15px] text-[var(--color-primary)] ${checkingUpdate ? 'animate-spin' : ''}`}>
            {updateAvailable ? 'download' : 'sync'}
          </span>
          <span>{updateAvailable ? 'Update' : checkingUpdate ? 'Checking' : 'Check'}</span>
        </button>
      </div>

      {/* Section: Appearance & Theming */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] uppercase tracking-wider font-bold text-[#a1a1aa] px-1">
          Appearance &amp; Colors
        </span>

        <div className="liquid-glass rounded-2xl p-4 flex flex-col gap-4 shadow-sm border border-white/[0.04]">
          {/* Dynamic Colors Switch */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">auto_awesome</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] text-[#e4e1e7] font-semibold leading-snug">Dynamic Colors</span>
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  Adapt accents to album artwork
                </span>
              </div>
            </div>

            <button 
              id="toggle-dynamic-colors-switch"
              role="switch"
              aria-checked={settings.dynamicColors}
              onClick={() => onUpdateSettings({ dynamicColors: !settings.dynamicColors })}
              className={`w-11 h-6 rounded-full relative p-0.5 flex items-center transition-colors cursor-pointer ${
                settings.dynamicColors ? 'bg-[var(--color-primary)]' : 'liquid-glass'
              }`}
            >
              <div className={`w-5 h-5 rounded-full shadow transition-transform flex items-center justify-center ${
                settings.dynamicColors ? 'bg-[#670211] translate-x-5' : 'bg-[#574140] translate-x-0'
              }`}>
                {settings.dynamicColors && (
                  <span className="material-symbols-outlined floating-icon text-[12px] text-[var(--color-primary)]">check</span>
                )}
              </div>
            </button>
          </div>

          {/* Accent Color Palette */}
          <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.05]">
            <span className="text-[12px] text-[#a1a1aa] font-medium">Accent Color</span>
            <div className="flex items-center justify-between px-1 py-1">
              {accentColors.map((color) => {
                const isSelected = settings.accentColor === color.id;
                return (
                  <button
                    key={color.id}
                    id={`accent-swatch-${color.id}`}
                    aria-label={`${color.name} Accent`}
                    onClick={() => onUpdateSettings({ accentColor: color.id })}
                    style={{ backgroundColor: color.hex }}
                    className={`relative rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      isSelected 
                        ? 'w-10 h-10 scale-110 ring-2 ring-white/40 shadow-lg' 
                        : 'w-8 h-8 opacity-75 hover:opacity-100 hover:scale-105'
                    }`}
                  >
                    {isSelected && (
                      <span className="material-symbols-outlined floating-icon text-[#131317] text-[18px] font-bold">
                        check
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pure Black AMOLED Mode */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.05]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">dark_mode</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] text-[#e4e1e7] font-semibold leading-snug">Pure Black AMOLED</span>
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  Deep black canvas for battery saving
                </span>
              </div>
            </div>

            <button 
              id="toggle-amoled-switch"
              role="switch"
              aria-checked={settings.pureBlackAmoled}
              onClick={() => onUpdateSettings({ pureBlackAmoled: !settings.pureBlackAmoled })}
              className={`w-11 h-6 rounded-full relative p-0.5 flex items-center transition-colors cursor-pointer ${
                settings.pureBlackAmoled ? 'bg-[var(--color-primary)]' : 'liquid-glass'
              }`}
            >
              <div className={`w-5 h-5 rounded-full shadow transition-transform flex items-center justify-center ${
                settings.pureBlackAmoled ? 'bg-[#670211] translate-x-5' : 'bg-[#574140] translate-x-0'
              }`}>
                {settings.pureBlackAmoled && (
                  <span className="material-symbols-outlined floating-icon text-[12px] text-[var(--color-primary)]">check</span>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Section: Playback & Streaming */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] uppercase tracking-wider font-bold text-[#a1a1aa] px-1">
          Playback &amp; Streaming
        </span>

        <div className="liquid-glass rounded-2xl p-4 flex flex-col gap-4 shadow-sm border border-white/[0.04]">
          {/* Adaptive Bitrate (ABR) */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">speed</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] text-[#e4e1e7] font-semibold leading-snug">Adaptive Bitrate (ABR)</span>
                  {settings.adaptiveBitrate !== false && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      Zero-Stall
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  Dynamically scales 64k-320k to internet speed to eliminate buffering
                </span>
              </div>
            </div>

            <button 
              id="toggle-abr-switch"
              role="switch"
              aria-checked={settings.adaptiveBitrate !== false}
              onClick={() => {
                const nextVal = settings.adaptiveBitrate === false ? true : false;
                onUpdateSettings({ adaptiveBitrate: nextVal });
                adaptiveBitrateService.setAutoAbr(nextVal);
                triggerToast(nextVal ? 'ABR: Auto bitrate adjustment active' : 'ABR: Manual fixed quality mode');
              }}
              className={`w-11 h-6 rounded-full relative p-0.5 flex items-center transition-colors cursor-pointer shrink-0 ${
                settings.adaptiveBitrate !== false ? 'bg-[var(--color-primary)]' : 'liquid-glass'
              }`}
            >
              <div className={`w-5 h-5 rounded-full shadow transition-transform flex items-center justify-center ${
                settings.adaptiveBitrate !== false ? 'bg-[#670211] translate-x-5' : 'bg-[#574140] translate-x-0'
              }`}>
                {settings.adaptiveBitrate !== false && (
                  <span className="material-symbols-outlined floating-icon text-[12px] text-[var(--color-primary)]">check</span>
                )}
              </div>
            </button>
          </div>

          {/* Lookahead 10s Pre-buffering */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.05]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">bolt</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] text-[#e4e1e7] font-semibold leading-snug">Lookahead 10s Pre-buffer</span>
                  {settings.prebufferNextTrack !== false && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold">
                      0ms Handoff
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  Pre-buffers first 10s of next track in queue for instant playback start
                </span>
              </div>
            </div>

            <button 
              id="toggle-prebuffer-switch"
              role="switch"
              aria-checked={settings.prebufferNextTrack !== false}
              onClick={() => {
                const nextVal = settings.prebufferNextTrack === false ? true : false;
                onUpdateSettings({ prebufferNextTrack: nextVal });
                triggerToast(nextVal ? 'Pre-buffering: 10s next track buffer enabled' : 'Pre-buffering: Disabled');
              }}
              className={`w-11 h-6 rounded-full relative p-0.5 flex items-center transition-colors cursor-pointer shrink-0 ${
                settings.prebufferNextTrack !== false ? 'bg-[var(--color-primary)]' : 'liquid-glass'
              }`}
            >
              <div className={`w-5 h-5 rounded-full shadow transition-transform flex items-center justify-center ${
                settings.prebufferNextTrack !== false ? 'bg-[#670211] translate-x-5' : 'bg-[#574140] translate-x-0'
              }`}>
                {settings.prebufferNextTrack !== false && (
                  <span className="material-symbols-outlined floating-icon text-[12px] text-[var(--color-primary)]">check</span>
                )}
              </div>
            </button>
          </div>

          {/* Streaming Protocol Selection */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.05]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">stream</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] text-[#e4e1e7] font-semibold leading-snug">Streaming Protocol</span>
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  {settings.streamingProtocol === 'dash' ? 'MPEG-DASH (Adaptive Segment XML)' : 'HLS Chunked Stream (.m3u8)'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 bg-white/5 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => {
                  onUpdateSettings({ streamingProtocol: 'hls' });
                  adaptiveBitrateService.setProtocol('HLS / Chunked ABR');
                  triggerToast('Protocol switched to HLS');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  (settings.streamingProtocol || 'hls') === 'hls'
                    ? 'bg-[var(--color-primary)] text-[#6c0513]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                HLS
              </button>
              <button
                onClick={() => {
                  onUpdateSettings({ streamingProtocol: 'dash' });
                  adaptiveBitrateService.setProtocol('MPEG-DASH ABR');
                  triggerToast('Protocol switched to MPEG-DASH');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  settings.streamingProtocol === 'dash'
                    ? 'bg-[var(--color-primary)] text-[#6c0513]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                DASH
              </button>
            </div>
          </div>

          {/* Background & Screen-Off Playback */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.05]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">screen_lock_portrait</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] text-[#e4e1e7] font-semibold leading-snug">Background &amp; Screen-Off</span>
                  {settings.backgroundPlayback && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      Active
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  Play music continuously when screen is locked or app minimized
                </span>
              </div>
            </div>

            <button 
              id="toggle-background-playback-switch"
              role="switch"
              aria-checked={settings.backgroundPlayback}
              onClick={() => {
                const nextVal = !settings.backgroundPlayback;
                onUpdateSettings({ backgroundPlayback: nextVal });
                triggerToast(nextVal ? 'Background Playback: Screen-Off audio enabled' : 'Background Playback: Disabled');
              }}
              className={`w-11 h-6 rounded-full relative p-0.5 flex items-center transition-colors cursor-pointer shrink-0 ${
                settings.backgroundPlayback ? 'bg-[var(--color-primary)]' : 'liquid-glass'
              }`}
            >
              <div className={`w-5 h-5 rounded-full shadow transition-transform flex items-center justify-center ${
                settings.backgroundPlayback ? 'bg-[#670211] translate-x-5' : 'bg-[#574140] translate-x-0'
              }`}>
                {settings.backgroundPlayback && (
                  <span className="material-symbols-outlined floating-icon text-[12px] text-[var(--color-primary)]">check</span>
                )}
              </div>
            </button>
          </div>

          {/* Skip Silence */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.05]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">volume_off</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] text-[#e4e1e7] font-semibold leading-snug">Skip Silence</span>
                  {settings.skipSilence && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      Trim Active
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  Automatically skip silent intro gaps and trailing outro tails
                </span>
              </div>
            </div>

            <button 
              id="toggle-skip-silence-switch"
              role="switch"
              aria-checked={settings.skipSilence}
              onClick={() => {
                const nextVal = !settings.skipSilence;
                onUpdateSettings({ skipSilence: nextVal });
                triggerToast(nextVal ? 'Skip Silence: Trimming intro & outro silence' : 'Skip Silence: Disabled');
              }}
              className={`w-11 h-6 rounded-full relative p-0.5 flex items-center transition-colors cursor-pointer shrink-0 ${
                settings.skipSilence ? 'bg-[var(--color-primary)]' : 'liquid-glass'
              }`}
            >
              <div className={`w-5 h-5 rounded-full shadow transition-transform flex items-center justify-center ${
                settings.skipSilence ? 'bg-[#670211] translate-x-5' : 'bg-[#574140] translate-x-0'
              }`}>
                {settings.skipSilence && (
                  <span className="material-symbols-outlined floating-icon text-[12px] text-[var(--color-primary)]">check</span>
                )}
              </div>
            </button>
          </div>

          {/* Skip Sponsor / Non-Music (SponsorBlock) */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.05]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">fast_forward</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] text-[#e4e1e7] font-semibold leading-snug">Skip Sponsor &amp; Intros</span>
                  {settings.skipSponsor && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-semibold">
                      SponsorBlock ON
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  Auto-skips non-music dialogue, actor intros &amp; promo segments
                </span>
              </div>
            </div>

            <button 
              id="toggle-skip-sponsor-switch"
              role="switch"
              aria-checked={settings.skipSponsor}
              onClick={() => {
                const nextVal = !settings.skipSponsor;
                onUpdateSettings({ skipSponsor: nextVal });
                triggerToast(nextVal ? 'SponsorBlock: Auto-skipping video intros & dialogue' : 'SponsorBlock: Disabled');
              }}
              className={`w-11 h-6 rounded-full relative p-0.5 flex items-center transition-colors cursor-pointer shrink-0 ${
                settings.skipSponsor ? 'bg-[var(--color-primary)]' : 'liquid-glass'
              }`}
            >
              <div className={`w-5 h-5 rounded-full shadow transition-transform flex items-center justify-center ${
                settings.skipSponsor ? 'bg-[#670211] translate-x-5' : 'bg-[#574140] translate-x-0'
              }`}>
                {settings.skipSponsor && (
                  <span className="material-symbols-outlined floating-icon text-[12px] text-[var(--color-primary)]">check</span>
                )}
              </div>
            </button>
          </div>

          {/* Volume Normalization */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.05]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">tune</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] text-[#e4e1e7] font-semibold leading-snug">Volume Normalization</span>
                  {settings.volumeNormalization && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold">
                      Auto-Leveling
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  Harmonizes loudness across all songs to prevent sudden loud bursts
                </span>
              </div>
            </div>

            <button 
              id="toggle-volume-norm-switch"
              role="switch"
              aria-checked={settings.volumeNormalization}
              onClick={() => {
                const nextVal = !settings.volumeNormalization;
                onUpdateSettings({ volumeNormalization: nextVal });
                triggerToast(nextVal ? 'Volume Normalization: Active (Balanced LUFS Level)' : 'Volume Normalization: Disabled (Raw Gain)');
              }}
              className={`w-11 h-6 rounded-full relative p-0.5 flex items-center transition-colors cursor-pointer shrink-0 ${
                settings.volumeNormalization ? 'bg-[var(--color-primary)]' : 'liquid-glass'
              }`}
            >
              <div className={`w-5 h-5 rounded-full shadow transition-transform flex items-center justify-center ${
                settings.volumeNormalization ? 'bg-[#670211] translate-x-5' : 'bg-[#574140] translate-x-0'
              }`}>
                {settings.volumeNormalization && (
                  <span className="material-symbols-outlined floating-icon text-[12px] text-[var(--color-primary)]">check</span>
                )}
              </div>
            </button>
          </div>

          {/* Stream Output Quality (Interactive Selector) */}
          <div 
            id="stream-quality-selector-btn"
            onClick={() => setIsQualityModalOpen(true)}
            className="flex items-center justify-between pt-3 border-t border-white/[0.05] cursor-pointer hover:bg-white/[0.02] -mx-2 px-2 py-1.5 rounded-xl transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-emerald-400 shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">high_quality</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] text-[#e4e1e7] font-semibold leading-snug">Audio Streaming Quality</span>
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  Tap to switch bitrate &amp; audio resolution
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-semibold text-emerald-400 text-[12px] flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {settings.audioQuality || '320kbps High-Res'}
              </span>
              <span className="material-symbols-outlined floating-icon text-[#a1a1aa] text-[18px]">chevron_right</span>
            </div>
          </div>

          {/* Streaming Engine / Provider (Interactive Selector) */}
          <div 
            id="stream-engine-selector-btn"
            onClick={() => setIsInstanceModalOpen(true)}
            className="flex items-center justify-between pt-3 border-t border-white/[0.05] cursor-pointer hover:bg-white/[0.02] -mx-2 px-2 py-1.5 rounded-xl transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-cyan-400 shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">dns</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] text-[#e4e1e7] font-semibold leading-snug">Streaming Route &amp; Server</span>
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  Select streaming pipeline and proxy fallback
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-semibold text-cyan-400 text-[12px] flex items-center gap-1.5 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                {settings.invidiousInstance?.replace(' Stream', '') || 'Direct YouTube'}
              </span>
              <span className="material-symbols-outlined floating-icon text-[#a1a1aa] text-[18px]">chevron_right</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Playback Navigation & Controls */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] uppercase tracking-wider font-bold text-[#a1a1aa] px-1">
          Playback Navigation &amp; Controls
        </span>

        <div className="liquid-glass rounded-2xl p-4 flex flex-col gap-3 shadow-sm border border-white/[0.04]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-amber-400 shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">skip_previous</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] text-[#e4e1e7] font-semibold leading-snug">Smart Previous Track</span>
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  Restart song if played &gt; threshold, else go to previous
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
              {[0, 3, 5, 8].map((threshold) => {
                const isSelected = (settings.prevRestartThresholdSec ?? 3) === threshold;
                return (
                  <button
                    key={threshold}
                    onClick={() => {
                      onUpdateSettings({ prevRestartThresholdSec: threshold });
                      triggerToast(threshold === 0 ? 'Smart Previous: Always Go to Previous' : `Previous Button: Restart if played > ${threshold}s`);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                      isSelected
                        ? 'bg-[var(--color-primary)] text-white shadow-sm'
                        : 'text-[#a1a1aa] hover:text-[#e4e1e7]'
                    }`}
                  >
                    {threshold === 0 ? 'Off' : `${threshold}s`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Section: Audio & Equalizer */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] uppercase tracking-wider font-bold text-[#a1a1aa] px-1">
          Audio &amp; Equalizer
        </span>

        <div className="liquid-glass rounded-2xl p-4 flex flex-col gap-3 shadow-sm border border-white/[0.04]">
          <div 
            onClick={onOpenEqualizer}
            className="flex items-center justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">graphic_eq</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] text-[#e4e1e7] font-semibold">Equalizer &amp; Sound FX</span>
                <span className="text-[12px] text-[var(--color-primary)] capitalize">
                  Preset: {settings.equalizerPreset} • Bass Boost
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined floating-icon text-[#a1a1aa] text-[20px]">chevron_right</span>
          </div>
        </div>
      </div>

      {/* Section: Storage & Cache */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] uppercase tracking-wider font-bold text-[#a1a1aa] px-1">
          Storage
        </span>

        <div className="liquid-glass rounded-2xl p-4 flex flex-col gap-4 shadow-sm border border-white/[0.04]">
          {/* Offline Cache Toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">download_for_offline</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] text-[#e4e1e7] font-semibold leading-snug">Offline Cache</span>
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  Show downloads and cache tracks for offline
                </span>
              </div>
            </div>

            <button 
              id="toggle-offline-cache-switch"
              role="switch"
              aria-checked={settings.enableOfflineCache}
              onClick={() => onUpdateSettings({ enableOfflineCache: !settings.enableOfflineCache })}
              className={`w-11 h-6 rounded-full relative p-0.5 flex items-center transition-colors cursor-pointer ${
                settings.enableOfflineCache ? 'bg-[var(--color-primary)]' : 'liquid-glass'
              }`}
            >
              <div className={`w-5 h-5 rounded-full shadow transition-transform flex items-center justify-center ${
                settings.enableOfflineCache ? 'bg-[#670211] translate-x-5' : 'bg-[#574140] translate-x-0'
              }`}>
                {settings.enableOfflineCache && (
                  <span className="material-symbols-outlined floating-icon text-[12px] text-[var(--color-primary)]">check</span>
                )}
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.05]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">cached</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] text-[#e4e1e7] font-semibold">Audio Cache</span>
                <span className="text-[12px] text-[#a1a1aa]">
                  {cacheCleared ? 'Cache cleared (0 MB)' : (storage.totalTracks > 0 ? `${storage.totalFormatted} cached audio (${storage.totalTracks} tracks)` : '0 MB cached audio')}
                </span>
              </div>
            </div>

            <button
              onClick={handleClearCache}
              disabled={cacheCleared}
              className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border ${
                cacheCleared
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'liquid-glass text-[#e4e1e7] border-white/[0.05] hover:bg-white/[0.2] hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)] active:scale-95'
              }`}
            >
              {cacheCleared ? 'Cleared' : 'Clear Cache'}
            </button>
          </div>

          {/* Restart App from Beginning */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.05]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-amber-400 shrink-0">
                <span className="material-symbols-outlined floating-icon text-[20px]">restart_alt</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] text-[#e4e1e7] font-semibold">Restart App</span>
                <span className="text-[12px] text-[#a1a1aa] truncate">
                  Reload fresh from boot splash &amp; initial state
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                id="restart-app-btn"
                onClick={() => {
                  triggerToast('Restarting app from beginning...');
                  setTimeout(() => {
                    window.location.reload();
                  }, 400);
                }}
                className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold liquid-glass text-[#e4e1e7] border border-white/[0.05] hover:bg-white/[0.2] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer active:scale-95"
              >
                Restart
              </button>
              <button
                id="reset-restart-app-btn"
                onClick={() => {
                  if (window.confirm('Reset all saved settings, history, and restart from scratch?')) {
                    try {
                      localStorage.clear();
                      sessionStorage.clear();
                    } catch {}
                    triggerToast('App reset. Reloading...');
                    setTimeout(() => {
                      window.location.reload();
                    }, 400);
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer active:scale-95"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center justify-center pt-2 pb-4 text-center">
        <span className="text-[12px] font-semibold text-[#a1a1aa]">Streamzy v3.0.5</span>
        <span className="text-[11px] text-[#a1a1aa]/60 mt-0.5">
          Clean, Simple &amp; Fast Music Streaming
        </span>
      </div>

      {/* Toast Feedback */}
      {settingToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 liquid-glass/95 backdrop-blur-xl border border-white/10 text-[#f4f4f5] text-[13px] font-medium rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none whitespace-nowrap">
          <span className="material-symbols-outlined floating-icon text-[16px] text-emerald-400">check_circle</span>
          <span>{settingToast}</span>
        </div>
      )}

      {/* Audio Streaming Quality Modal */}
      {isQualityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="liquid-glass border border-white/10 rounded-2xl p-5 max-w-sm w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined floating-icon text-emerald-400 text-[22px]">high_quality</span>
                <h3 className="text-[16px] font-bold text-white">Audio Streaming Quality</h3>
              </div>
              <button 
                onClick={() => setIsQualityModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#a1a1aa] hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <span className="material-symbols-outlined floating-icon text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {[
                { id: '320kbps High-Res Audio', label: '320kbps High-Res', desc: 'Ultra HD Lossless Opus/AAC • Studio Quality', badge: 'Best' },
                { id: '256kbps High Quality', label: '256kbps High Quality', desc: 'Balanced high fidelity & fast buffering', badge: 'Standard' },
                { id: '128kbps Standard Audio', label: '128kbps Data Saver', desc: 'Low mobile data usage & ultra fast play', badge: 'Saver' },
                { id: 'Auto (Adaptive Bitrate)', label: 'Auto (Adaptive)', desc: 'Automatically adjusts to network speed', badge: 'Adaptive' },
              ].map((opt) => {
                const isSelected = settings.audioQuality === opt.id || (!settings.audioQuality && opt.id.includes('320'));
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onUpdateSettings({ audioQuality: opt.id });
                      setIsQualityModalOpen(false);
                      triggerToast(`Audio Quality set to ${opt.label}`);
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                        : 'liquid-glass border-white/[0.04] text-[#e4e1e7] hover:bg-white/15'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold">{opt.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                          isSelected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-[#a1a1aa]'
                        }`}>
                          {opt.badge}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#a1a1aa] mt-0.5">{opt.desc}</span>
                    </div>

                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-emerald-400 bg-emerald-400' : 'border-white/20'
                    }`}>
                      {isSelected && (
                        <span className="material-symbols-outlined floating-icon text-[14px] text-black font-bold">check</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Streaming Instance / Provider Modal */}
      {isInstanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="liquid-glass border border-white/10 rounded-2xl p-5 max-w-sm w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined floating-icon text-cyan-400 text-[22px]">dns</span>
                <h3 className="text-[16px] font-bold text-white">Streaming Server &amp; Engine</h3>
              </div>
              <button 
                onClick={() => setIsInstanceModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#a1a1aa] hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <span className="material-symbols-outlined floating-icon text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {[
                { id: 'Direct YouTube Stream', label: 'Direct YouTube Stream', desc: 'Fastest playback, official stream CDN & high stability', tag: 'Fastest' },
                { id: 'Piped Privacy Stream', label: 'Piped Audio Stream', desc: 'Direct Opus audio stream extraction with ad-free routing', tag: 'Opus 320k' },
                { id: 'Invidious Open Proxy', label: 'Invidious Open Proxy', desc: 'Decentralized open proxy network', tag: 'Proxy' },
                { id: 'Auto Intelligent Fallback', label: 'Auto Intelligent Fallback', desc: 'Auto-switches to the fastest working stream', tag: 'Smart' },
              ].map((opt) => {
                const isSelected = settings.invidiousInstance === opt.id || (!settings.invidiousInstance && opt.id.includes('Direct'));
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onUpdateSettings({ invidiousInstance: opt.id });
                      setIsInstanceModalOpen(false);
                      triggerToast(`Streaming Route: ${opt.label}`);
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                        : 'liquid-glass border-white/[0.04] text-[#e4e1e7] hover:bg-white/15'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold">{opt.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                          isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-[#a1a1aa]'
                        }`}>
                          {opt.tag}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#a1a1aa] mt-0.5">{opt.desc}</span>
                    </div>

                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-white/20'
                    }`}>
                      {isSelected && (
                        <span className="material-symbols-outlined floating-icon text-[14px] text-black font-bold">check</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
