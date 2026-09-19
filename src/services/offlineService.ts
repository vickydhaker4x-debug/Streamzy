import { Track, DownloadRecord } from '../types';
import { encryptedStorageService } from './encryptedStorageService';
import { networkMonitorService } from './networkMonitorService';
import { sanitizeTrackForPersistence } from './musicNormalizationService';

const STORAGE_DOWNLOADS_KEY = 'vd_music_downloads_v1';
const STORAGE_SMART_CONFIG_KEY = 'vd_music_smart_downloads_config';
const STORAGE_OFFLINE_MODE_KEY = 'vd_music_offline_only_mode';

type Listener = () => void;

interface SmartConfig {
  enabled: boolean;
  limit: number;
}

export interface DownloadProgressInfo {
  trackId: string;
  progress: number;
  stage: 'queued' | 'fetching' | 'encrypting' | 'saving' | 'completed' | 'error';
}

class OfflineService {
  private downloads: Map<string, DownloadRecord> = new Map();
  private smartConfig: SmartConfig = { enabled: false, limit: 8 };
  private offlineOnlyMode: boolean = false;
  private listeners: Set<Listener> = new Set();
  private downloadingMap: Map<string, DownloadProgressInfo> = new Map();

  constructor() {
    this.loadFromStorage();
    this.syncWithEncryptedVault();
    this.initNetworkAutoFallback();
  }

  private initNetworkAutoFallback() {
    networkMonitorService.subscribe((netState) => {
      // The exact millisecond the network drops, switch to offline mode
      if (!netState.isOnline && networkMonitorService.isAutoFallback()) {
        if (!this.offlineOnlyMode) {
          this.offlineOnlyMode = true;
          this.notify();
        }
      }
    });
  }

  private async syncWithEncryptedVault() {
    try {
      const vaultTracks = await encryptedStorageService.getAllDownloadedTracks();
      if (vaultTracks && vaultTracks.length > 0) {
        vaultTracks.forEach((t) => {
          if (!this.downloads.has(t.id)) {
            const secs = t.durationSec || 210;
            const sizeBytes = Math.round(secs * 42 * 1024);
            this.downloads.set(t.id, {
              trackId: t.id,
              track: t,
              downloadedAt: Date.now(),
              sizeBytes,
              isSmartDownload: Boolean(t.isSmartDownloaded),
              quality: t.quality || '320kbps High-Res Audio'
            });
          }
        });
        this.notify();
      }
    } catch {}
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;

    try {
      const rawRecords = localStorage.getItem(STORAGE_DOWNLOADS_KEY);
      if (rawRecords) {
        const parsed = JSON.parse(rawRecords);
        if (Array.isArray(parsed)) {
          parsed.forEach((rec: DownloadRecord) => {
            if (rec && rec.trackId) {
              this.downloads.set(rec.trackId, rec);
            }
          });
        }
      }

      const rawConfig = localStorage.getItem(STORAGE_SMART_CONFIG_KEY);
      if (rawConfig) {
        this.smartConfig = { ...this.smartConfig, ...JSON.parse(rawConfig) };
      }

      const rawOffline = localStorage.getItem(STORAGE_OFFLINE_MODE_KEY);
      if (rawOffline !== null) {
        this.offlineOnlyMode = JSON.parse(rawOffline);
      }
    } catch (e) {
      console.warn('Failed to load offline storage records', e);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      const array = Array.from(this.downloads.values()).map((record) => ({
        ...record,
        track: sanitizeTrackForPersistence(record.track)
      }));
      localStorage.setItem(STORAGE_DOWNLOADS_KEY, JSON.stringify(array));
      localStorage.setItem(STORAGE_SMART_CONFIG_KEY, JSON.stringify(this.smartConfig));
      localStorage.setItem(STORAGE_OFFLINE_MODE_KEY, JSON.stringify(this.offlineOnlyMode));
    } catch (e) {
      console.warn('Failed to save offline storage records', e);
    }
  }

  private notify() {
    this.saveToStorage();
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error(e);
      }
    });
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public isDownloaded(trackId: string): boolean {
    return this.downloads.has(trackId);
  }

  public isSmartDownloaded(trackId: string): boolean {
    const rec = this.downloads.get(trackId);
    return Boolean(rec?.isSmartDownload);
  }

  public isDownloading(trackId: string): boolean {
    return this.downloadingMap.has(trackId);
  }

  public getDownloadProgress(trackId: string): DownloadProgressInfo | undefined {
    return this.downloadingMap.get(trackId);
  }

  public getDownloadRecord(trackId: string): DownloadRecord | undefined {
    return this.downloads.get(trackId);
  }

  public getAllDownloads(): DownloadRecord[] {
    return Array.from(this.downloads.values()).sort((a, b) => b.downloadedAt - a.downloadedAt);
  }

  public getDownloadedTracks(): Track[] {
    return this.getAllDownloads().map((d) => ({
      ...d.track,
      isDownloaded: true,
      isSmartDownloaded: d.isSmartDownload
    }));
  }

  /**
   * Downloads a track, encrypts with AES-256-GCM in IndexedDB, and updates download record
   */
  public downloadTrack(track: Track, isSmart = false): DownloadRecord {
    const existing = this.downloads.get(track.id);
    if (existing) {
      if (existing.isSmartDownload && !isSmart) {
        existing.isSmartDownload = false;
        this.notify();
      }
      return existing;
    }

    const secs = track.durationSec || 210;
    const sizeBytes = Math.round(secs * 42 * 1024);

    const record: DownloadRecord = {
      trackId: track.id,
      track: {
        ...track,
        isDownloaded: true,
        isSmartDownloaded: isSmart
      },
      downloadedAt: Date.now(),
      sizeBytes,
      isSmartDownload: isSmart,
      quality: track.quality || '320kbps High-Res Audio'
    };

    this.downloads.set(track.id, record);

    // Track download progress
    this.downloadingMap.set(track.id, {
      trackId: track.id,
      progress: 10,
      stage: 'fetching'
    });
    this.notify();

    // Trigger async AES-256 encrypted storage
    encryptedStorageService
      .downloadAndEncryptTrack(track, {
        isSmart,
        onProgress: (progress, stage) => {
          this.downloadingMap.set(track.id, {
            trackId: track.id,
            progress,
            stage
          });
          if (stage === 'completed') {
            setTimeout(() => {
              this.downloadingMap.delete(track.id);
              this.notify();
            }, 800);
          }
          this.notify();
        }
      })
      .catch((err) => {
        console.warn('Encrypted audio download failed, kept metadata record:', err);
        this.downloadingMap.delete(track.id);
        this.notify();
      });

    this.notify();
    return record;
  }

  public removeDownload(trackId: string): void {
    if (this.downloads.has(trackId)) {
      this.downloads.delete(trackId);
      this.downloadingMap.delete(trackId);
      encryptedStorageService.deleteTrack(trackId).catch(() => {});
      this.notify();
    }
  }

  public toggleDownload(track: Track): boolean {
    if (this.isDownloaded(track.id)) {
      this.removeDownload(track.id);
      return false;
    } else {
      this.downloadTrack(track, false);
      return true;
    }
  }

  public clearAllDownloads(): void {
    this.downloads.clear();
    this.downloadingMap.clear();
    encryptedStorageService.clearVault().catch(() => {});
    this.notify();
  }

  public clearSmartDownloads(): void {
    Array.from(this.downloads.entries()).forEach(([id, rec]) => {
      if (rec.isSmartDownload) {
        this.downloads.delete(id);
        encryptedStorageService.deleteTrack(id).catch(() => {});
      }
    });
    this.notify();
  }

  public isSmartDownloadsEnabled(): boolean {
    return this.smartConfig.enabled;
  }

  public setSmartDownloadsEnabled(enabled: boolean): void {
    this.smartConfig.enabled = enabled;
    this.notify();
  }

  public getSmartDownloadLimit(): number {
    return this.smartConfig.limit || 8;
  }

  public setSmartDownloadLimit(limit: number): void {
    this.smartConfig.limit = limit;
    this.notify();
  }

  public isOfflineOnlyMode(): boolean {
    return this.offlineOnlyMode || networkMonitorService.isOffline();
  }

  public setOfflineOnlyMode(enabled: boolean): void {
    this.offlineOnlyMode = enabled;
    this.notify();
  }

  /**
   * Smart Downloads Engine:
   * Analyzes playback history to calculate most frequently played tracks.
   * Automatically caches the top tracks locally in background with AES-256 encryption.
   */
  public syncSmartDownloads(history: Track[], allAvailableTracks: Track[]): { added: Track[]; totalSmart: number } {
    if (!this.smartConfig.enabled) {
      return { added: [], totalSmart: 0 };
    }

    const frequencyMap = new Map<string, { count: number; track: Track }>();

    history.forEach((track) => {
      const existing = frequencyMap.get(track.id);
      if (existing) {
        existing.count += 1;
      } else {
        frequencyMap.set(track.id, { count: 1, track });
      }
    });

    if (frequencyMap.size < this.smartConfig.limit) {
      for (const track of allAvailableTracks) {
        if (!frequencyMap.has(track.id)) {
          frequencyMap.set(track.id, { count: 1, track });
        }
        if (frequencyMap.size >= this.smartConfig.limit) break;
      }
    }

    const sorted = Array.from(frequencyMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, this.smartConfig.limit);

    const added: Track[] = [];

    sorted.forEach(({ track }) => {
      if (!this.downloads.has(track.id)) {
        this.downloadTrack(track, true);
        added.push(track);
      }
    });

    const totalSmart = Array.from(this.downloads.values()).filter((d) => d.isSmartDownload).length;
    return { added, totalSmart };
  }

  public getStorageBreakdown() {
    let totalBytes = 0;
    let smartBytes = 0;
    let manualBytes = 0;
    let smartCount = 0;
    let manualCount = 0;

    this.downloads.forEach((rec) => {
      totalBytes += rec.sizeBytes;
      if (rec.isSmartDownload) {
        smartCount += 1;
        smartBytes += rec.sizeBytes;
      } else {
        manualCount += 1;
        manualBytes += rec.sizeBytes;
      }
    });

    const formatMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1) + ' MB';

    return {
      totalTracks: this.downloads.size,
      totalBytes,
      totalFormatted: formatMb(totalBytes),
      smartCount,
      smartFormatted: formatMb(smartBytes),
      manualCount,
      manualFormatted: formatMb(manualBytes)
    };
  }
}

export const offlineService = new OfflineService();
