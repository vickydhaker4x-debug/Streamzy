import React, { useState, useEffect } from 'react';
import { SettingsState, AccentColor, Track } from '../types';

interface SettingsScreenProps {
  settings: SettingsState;
  onUpdateSettings: (newSettings: Partial<SettingsState>) => void;
  onBack: () => void;
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
const GITHUB_REPO = 'vickydhaker4x/VD-Music';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onBack,
  currentTrack: _currentTrack,
  isPlaying: _isPlaying = false,
  currentTimeSec: _currentTimeSec = 0,
  onTogglePlay: _onTogglePlay = () => {},
  onNextTrack: _onNextTrack = () => {},
  onPrevTrack: _onPrevTrack = () => {},
  onToggleFavorite: _onToggleFavorite = () => {},
  onSeek: _onSeek = () => {}
}) => {
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState(`Up to date • Release Build ${APP_VERSION}`);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [isQualityModalOpen, setIsQualityModalOpen] = useState(false);
  const [settingToast, setSettingToast] = useState<string | null>(null);

  useEffect(() => {
    // Check for updates silently on mount
    checkForUpdates(true);
  }, []);

  const checkForUpdates = async (silent = false) => {
    if (!silent) setCheckingUpdate(true);
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
      
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
      if (latestVersion && latestVersion !== APP_VERSION && latestVersion > APP_VERSION) {
        setUpdateMessage(`New update available: ${latestVersion}`);
        const apkAsset = data.assets?.find((a: any) => a.name.endsWith('.apk'));
        if (apkAsset) {
          setUpdateAvailable(apkAsset.browser_download_url);
        } else {
          setUpdateAvailable(data.html_url);
        }
      } else {
        if (!silent) {
          setUpdateMessage(`Streamzy ${APP_VERSION} is up to date!`);
        }
      }
    } catch {
      if (!silent) {
        setUpdateMessage(`Streamzy ${APP_VERSION} is up to date!`);
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

      {/* Section: Audio Quality */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] uppercase tracking-wider font-bold text-[#a1a1aa] px-1">
          Audio Quality
        </span>

        <div className="liquid-glass rounded-2xl p-4 flex flex-col gap-3 shadow-sm border border-white/[0.04]">
          {/* Stream Output Quality */}
          <div 
            id="stream-quality-selector-btn"
            onClick={() => setIsQualityModalOpen(true)}
            className="flex items-center justify-between cursor-pointer hover:bg-white/[0.02] -mx-2 px-2 py-1.5 rounded-xl transition-all"
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
        </div>
      </div>

      {/* Section: System & App Maintenance */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] uppercase tracking-wider font-bold text-[#a1a1aa] px-1">
          System
        </span>

        <div className="liquid-glass rounded-2xl p-4 flex flex-col gap-3 shadow-sm border border-white/[0.04]">
          {/* Restart App from Beginning */}
          <div className="flex items-center justify-between gap-3">
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
    </div>
  );
};
