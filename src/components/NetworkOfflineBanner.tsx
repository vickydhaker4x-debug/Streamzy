/**
 * Network Offline Banner & Status Bar
 * Displays real-time offline status, auto-fallback switch notification,
 * and quick controls to test network dropping and encrypted storage.
 */

import React, { useState, useEffect } from 'react';
import { networkMonitorService, NetworkState } from '../services/networkMonitorService';
import { offlineService } from '../services/offlineService';
import { encryptedStorageService, StorageVaultStats } from '../services/encryptedStorageService';

interface NetworkOfflineBannerProps {
  onOpenDownloads?: () => void;
}

export const NetworkOfflineBanner: React.FC<NetworkOfflineBannerProps> = ({ onOpenDownloads }) => {
  const [netState, setNetState] = useState<NetworkState>(networkMonitorService.getState());
  const [vaultStats, setVaultStats] = useState<StorageVaultStats | null>(null);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    const unsub = networkMonitorService.subscribe((state) => {
      setNetState(state);
      if (!state.isOnline) {
        setIsDismissed(false); // Always re-show when network drops
        setShowToast('Network Disconnected • Switched to Local Encrypted Library');
        setTimeout(() => setShowToast(null), 4000);
      } else {
        setShowToast('Connection Restored • Cloud Streaming Active');
        setTimeout(() => setShowToast(null), 3500);
      }
    });

    encryptedStorageService.getVaultStats().then(setVaultStats).catch(() => {});

    return unsub;
  }, []);

  const isOffline = !netState.isOnline || netState.isSimulatedOffline;

  if (!isOffline && !showToast) {
    return null;
  }

  return (
    <>
      {/* Toast Notification upon status change */}
      {showToast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none">
          <div className={`px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-xl border flex items-center gap-2.5 text-xs font-semibold ${
            isOffline
              ? 'bg-amber-500/20 border-amber-500/30 text-amber-200'
              : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200'
          }`}>
            <span className="material-symbols-outlined text-[18px]">
              {isOffline ? 'cloud_off' : 'wifi'}
            </span>
            <span>{showToast}</span>
          </div>
        </div>
      )}

      {/* Persistent Offline Header Ribbon */}
      {isOffline && !isDismissed && (
        <div className="w-full bg-gradient-to-r from-amber-950/70 via-red-950/60 to-amber-950/70 border-b border-amber-500/20 px-3 py-2 text-xs flex items-center justify-between gap-3 text-amber-200 backdrop-blur-md sticky top-0 z-40 animate-fade-in shadow-md">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[18px] text-amber-400 shrink-0 animate-pulse">
              cloud_off
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0">
              <span className="font-bold text-white whitespace-nowrap">Offline Mode Active</span>
              <span className="text-amber-300/80 text-[11px] truncate">
                Browsing AES-256 Encrypted Vault ({vaultStats?.totalTracks || 3} cached songs)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenDownloads && (
              <button
                onClick={onOpenDownloads}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white transition active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">download</span>
                <span>Vault</span>
              </button>
            )}

            <button
              onClick={() => setIsDismissed(true)}
              className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-amber-300 hover:text-white transition cursor-pointer"
              title="Dismiss Ribbon"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
