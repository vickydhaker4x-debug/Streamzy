import React, { useState, useEffect } from 'react';
import { Track } from '../../types';
import { TrackImage } from '../TrackImage';
import { offlineService } from '../../services/offlineService';
import { encryptedStorageService, StorageVaultStats } from '../../services/encryptedStorageService';
import { networkMonitorService, NetworkState } from '../../services/networkMonitorService';

interface OfflineDownloadsSectionProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onPlayDownloadedQueue: (tracks: Track[], startIndex?: number) => void;
  onToggleFavorite: (trackId: string) => void;
  playbackHistory: Track[];
  allTracks: Track[];
}

export const OfflineDownloadsSection: React.FC<OfflineDownloadsSectionProps> = ({
  currentTrack,
  isPlaying,
  onSelectTrack,
  onPlayDownloadedQueue,
  onToggleFavorite,
  playbackHistory,
  allTracks
}) => {
  const [, setTick] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [vaultStats, setVaultStats] = useState<StorageVaultStats | null>(null);
  const [netState, setNetState] = useState<NetworkState>(networkMonitorService.getState());

  // Subscribe to offlineService and networkMonitorService updates
  useEffect(() => {
    const unsubOff = offlineService.subscribe(() => {
      setTick((t) => t + 1);
      encryptedStorageService.getVaultStats().then(setVaultStats).catch(() => {});
    });
    const unsubNet = networkMonitorService.subscribe((state) => {
      setNetState(state);
    });

    encryptedStorageService.getVaultStats().then(setVaultStats).catch(() => {});

    return () => {
      unsubOff();
      unsubNet();
    };
  }, []);

  const downloadedTracks = offlineService.getDownloadedTracks();
  const isSmartEnabled = offlineService.isSmartDownloadsEnabled();
  const smartLimit = offlineService.getSmartDownloadLimit();
  const isOfflineOnly = offlineService.isOfflineOnlyMode();
  const storage = offlineService.getStorageBreakdown();

  const handleToggleSmart = () => {
    const next = !isSmartEnabled;
    offlineService.setSmartDownloadsEnabled(next);
    if (next) {
      const res = offlineService.syncSmartDownloads(playbackHistory, allTracks);
      setSyncToast(`Smart Downloads enabled: synced ${res.totalSmart} frequent tracks`);
    } else {
      setSyncToast('Smart Downloads disabled');
    }
    setTimeout(() => setSyncToast(null), 3000);
  };

  const handleSyncNow = () => {
    const res = offlineService.syncSmartDownloads(playbackHistory, allTracks);
    setSyncToast(`Synced! ${res.totalSmart} frequent tracks cached locally.`);
    setTimeout(() => setSyncToast(null), 3000);
  };

  const handleToggleOfflineOnly = () => {
    const next = !isOfflineOnly;
    offlineService.setOfflineOnlyMode(next);
    setSyncToast(next ? 'Offline-Only Mode Active: browsing cached tracks' : 'Online streaming mode enabled');
    setTimeout(() => setSyncToast(null), 3000);
  };

  const handleRemoveTrack = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    offlineService.removeDownload(trackId);
  };

  const handleClearAll = () => {
    offlineService.clearAllDownloads();
    setShowClearConfirm(false);
    setSyncToast('All offline downloads cleared');
    setTimeout(() => setSyncToast(null), 2500);
  };

  return (
    <div id="offline-downloads-section" className="flex flex-col gap-4 animate-fade-in">
      {/* Toast Notification */}
      {syncToast && (
        <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[13px] font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined floating-icon text-[18px]">verified</span>
          <span>{syncToast}</span>
        </div>
      )}

      {/* Offline Mode Master Toggle Banner */}
      <div className="p-4 rounded-3xl liquid-glass border border-white/[0.08] shadow-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
            isOfflineOnly ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.06] text-[#a1a1aa]'
          }`}>
            <span className="material-symbols-outlined floating-icon text-[24px]">
              {isOfflineOnly ? 'cloud_off' : 'wifi'}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[14px] font-bold text-[#e4e1e7]">Offline-Only Mode</span>
            <span className="text-[12px] text-[#a1a1aa] truncate">
              {isOfflineOnly ? 'Restricting playback purely to local device cache' : 'Stream high-res and use offline cache'}
            </span>
          </div>
        </div>

        {/* Master Switch */}
        <button
          id="toggle-offline-only-btn"
          onClick={handleToggleOfflineOnly}
          className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer shrink-0 p-0.5 ${
            isOfflineOnly ? 'bg-emerald-500' : 'bg-white/20'
          }`}
        >
          <span
            className={`block w-6 h-6 rounded-full bg-white transition-transform ${
              isOfflineOnly ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Smart Downloads Config & Storage Meter Card */}
      <div className="p-5 rounded-3xl liquid-glass border border-white/[0.08] shadow-lg flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center">
              <span className="material-symbols-outlined floating-icon text-[20px]">auto_download</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-bold text-[#e4e1e7]">Smart Downloads</span>
              <span className="text-[11px] text-[#a1a1aa]">Auto-cache frequently played tracks</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="sync-smart-downloads-btn"
              onClick={handleSyncNow}
              className="px-3 py-1.5 rounded-full liquid-glass hover:bg-white/15 text-[12px] font-semibold text-[var(--color-primary)] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              title="Sync most played tracks to storage now"
            >
              <span className="material-symbols-outlined floating-icon text-[16px]">sync</span>
              Sync Now
            </button>

            <button
              id="toggle-smart-downloads-btn"
              onClick={handleToggleSmart}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 p-0.5 ${
                isSmartEnabled ? 'bg-[var(--color-primary)]' : 'bg-white/20'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  isSmartEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Smart Limit Selection */}
        {isSmartEnabled && (
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[12px]">
            <span className="text-[#a1a1aa]">Auto-download limit:</span>
            <div className="flex items-center gap-1.5">
              {[5, 8, 15, 20].map((limit) => (
                <button
                  key={limit}
                  onClick={() => {
                    offlineService.setSmartDownloadLimit(limit);
                    offlineService.syncSmartDownloads(playbackHistory, allTracks);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    smartLimit === limit
                      ? 'bg-[var(--color-primary)] text-[#670211]'
                      : 'bg-white/[0.06] text-[#a1a1aa] hover:text-[#e4e1e7]'
                  }`}
                >
                  {limit} tracks
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Storage Breakdown & AES-256 Vault Guarantee */}
        <div className="pt-3 border-t border-white/[0.06] flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-emerald-400">lock</span>
              <span className="text-[#e4e1e7] font-semibold">Encrypted Local Vault</span>
            </div>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
              AES-GCM (256-bit)
            </span>
          </div>

          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[#a1a1aa] font-medium">Local Storage Used:</span>
            <span className="font-bold text-[#e4e1e7]">{vaultStats?.totalFormatted || storage.totalFormatted} ({downloadedTracks.length} songs)</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#a1a1aa]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]"></span>
              Smart: {storage.smartCount} ({storage.smartFormatted})
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Manual: {storage.manualCount} ({storage.manualFormatted})
            </span>
            <span>•</span>
            <span className="text-emerald-400 font-medium">Anti-Extraction Protected</span>
          </div>
        </div>
      </div>

      {/* Network Connectivity & Auto-Fallback Test Card */}
      <div className="p-4 rounded-3xl liquid-glass border border-white/[0.08] shadow-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
            netState.isOnline ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
          }`}>
            <span className="material-symbols-outlined text-[20px]">
              {netState.isOnline ? 'wifi' : 'wifi_off'}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[#e4e1e7]">
                Network Status: {netState.isOnline ? 'Connected' : 'Offline'}
              </span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono uppercase font-bold ${
                netState.isOnline ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {netState.effectiveType}
              </span>
            </div>
            <span className="text-[11px] text-[#a1a1aa] truncate">
              {netState.isOnline
                ? `Latency: ${netState.rttMs}ms • Auto-offline fallback armed (0ms failover)`
                : 'Offline mode active • Remote API calls halted, serving from local vault'}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            const next = !netState.isSimulatedOffline;
            networkMonitorService.setSimulatedOffline(next);
            setSyncToast(next ? 'Simulated network drop! Auto-offline fallback activated' : 'Network reconnected! Online streaming active');
            setTimeout(() => setSyncToast(null), 3000);
          }}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer active:scale-95 shrink-0 ${
            netState.isSimulatedOffline
              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
          }`}
        >
          {netState.isSimulatedOffline ? 'Reconnect Network' : 'Simulate Network Drop'}
        </button>
      </div>

      {/* Control Bar: Play All & Clear */}
      {downloadedTracks.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] uppercase font-bold tracking-wider text-[#a1a1aa]">
            Cached Songs ({downloadedTracks.length})
          </span>

          <div className="flex items-center gap-2">
            <button
              id="play-all-downloads-btn"
              onClick={() => onPlayDownloadedQueue(downloadedTracks, 0)}
              className="px-4 py-2 rounded-full bg-[var(--color-primary)] text-[#670211] text-[12px] font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer floating-btn"
            >
              <span className="material-symbols-outlined floating-icon text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                play_arrow
              </span>
              Play All Offline
            </button>

            <button
              id="clear-all-downloads-dialog-btn"
              onClick={() => setShowClearConfirm(true)}
              className="px-3 py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[12px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined floating-icon text-[16px]">delete</span>
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Clear Confirmation Prompt */}
      {showClearConfirm && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-between gap-3 text-red-200">
          <span className="text-[13px] font-medium truncate">Remove all cached songs from local storage?</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1 rounded-full text-[12px] text-white/80 hover:bg-white/10 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="confirm-clear-downloads-btn"
              onClick={handleClearAll}
              className="px-3 py-1 rounded-full bg-red-500 text-white font-bold text-[12px] cursor-pointer hover:bg-red-600"
            >
              Delete All
            </button>
          </div>
        </div>
      )}

      {/* Downloaded Song List */}
      {downloadedTracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-10 liquid-glass rounded-3xl border border-white/[0.04] my-2">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined floating-icon text-[32px]">download_for_offline</span>
          </div>
          <h3 className="text-[17px] font-bold text-[#e4e1e7]">No Offline Songs Yet</h3>
          <p className="text-[13px] text-[#a1a1aa] max-w-sm mt-1 mb-4">
            Tap the download icon on any song, or turn on Smart Downloads above to auto-cache your favorite tracks for offline listening.
          </p>
          <button
            onClick={handleSyncNow}
            className="px-5 py-2.5 rounded-full bg-[var(--color-primary)] text-[#670211] text-[13px] font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined floating-icon text-[18px]">auto_download</span>
            Auto-Download Top Tracks Now
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {downloadedTracks.map((track, idx) => {
            const isThisActive = currentTrack?.id === track.id;
            const isSmart = offlineService.isSmartDownloaded(track.id);

            return (
              <div
                key={track.id}
                id={`downloaded-track-${track.id}`}
                onClick={() => onPlayDownloadedQueue(downloadedTracks, idx)}
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
                        <span className="material-symbols-outlined floating-icon text-[18px] text-[var(--color-primary)] animate-pulse">
                          volume_up
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[14px] font-bold truncate ${isThisActive ? 'text-[var(--color-primary)]' : 'text-[#e4e1e7]'}`}>
                        {track.title}
                      </span>
                      {isSmart && (
                        <span className="px-1.5 py-0.2 rounded-md bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-[9px] font-bold uppercase tracking-wider shrink-0 border border-[var(--color-primary)]/25">
                          Smart
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] text-[#a1a1aa] truncate mt-0.5">
                      {track.artist} • {track.album}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined floating-icon text-[15px]">lock</span>
                    <span className="text-[10px] font-mono bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">AES-256</span>
                  </span>

                  {/* Favorite button */}
                  <button
                    aria-label="Toggle favorite"
                    onClick={() => onToggleFavorite(track.id)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      track.isFavorite ? 'text-[var(--color-primary)]' : 'text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/5'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined floating-icon text-[18px]"
                      style={{ fontVariationSettings: track.isFavorite ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      {track.isFavorite ? 'favorite' : 'favorite_border'}
                    </span>
                  </button>

                  {/* Remove download button */}
                  <button
                    id={`remove-download-${track.id}`}
                    aria-label="Remove download"
                    title="Remove from offline downloads"
                    onClick={(e) => handleRemoveTrack(track.id, e)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#71717a] hover:text-red-400 hover:bg-white/5 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined floating-icon text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
