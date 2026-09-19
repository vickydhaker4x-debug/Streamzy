/**
 * Offline Database Service (Local Database Layer)
 * Mimics SQLite / Room / WatermelonDB architecture for instant offline queries.
 * When network drops, data source immediately switches to this service, halting all remote API calls.
 */

import { Track } from '../types';
import { encryptedStorageService } from './encryptedStorageService';
import { offlineService } from './offlineService';

export interface OfflineFeed {
  downloadedTracks: Track[];
  quickPicks: Track[];
  topArtists: string[];
  vaultStats: {
    totalTracks: number;
    totalFormatted: string;
    encryptionStandard: string;
  };
}

class OfflineDatabaseService {
  private memoryCache: Track[] = [];
  private isLoaded: boolean = false;

  constructor() {
    this.refreshMemoryCache();
    offlineService.subscribe(() => {
      this.refreshMemoryCache();
    });
  }

  /**
   * Refreshes the local in-memory SQLite/Room cache for 0ms queries
   */
  public async refreshMemoryCache(): Promise<Track[]> {
    try {
      const fromVault = await encryptedStorageService.getAllDownloadedTracks();
      const fromOfflineService = offlineService.getDownloadedTracks();

      // Merge and deduplicate by track ID
      const map = new Map<string, Track>();
      fromVault.forEach((t) => map.set(t.id, t));
      fromOfflineService.forEach((t) => {
        if (!map.has(t.id)) {
          map.set(t.id, t);
        }
      });

      this.memoryCache = Array.from(map.values());
      this.isLoaded = true;
      return this.memoryCache;
    } catch {
      return this.memoryCache;
    }
  }

  /**
   * Fast synchronous query of local cached/downloaded tracks (0ms latency)
   */
  public getOfflineTracksSync(): Track[] {
    if (this.memoryCache.length === 0) {
      return offlineService.getDownloadedTracks();
    }
    return this.memoryCache;
  }

  /**
   * Full asynchronous query of local SQLite/IndexedDB tracks
   */
  public async getOfflineTracks(): Promise<Track[]> {
    return this.refreshMemoryCache();
  }

  /**
   * Instant offline search over local database records (title, artist, album, genre)
   */
  public async searchOfflineTracks(query: string): Promise<Track[]> {
    const tracks = await this.getOfflineTracks();
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return tracks;

    return tracks.filter((t) => {
      const matchTitle = t.title.toLowerCase().includes(cleanQuery);
      const matchArtist = t.artist.toLowerCase().includes(cleanQuery);
      const matchAlbum = (t.album || '').toLowerCase().includes(cleanQuery);
      const matchGenre = (t.genre || '').toLowerCase().includes(cleanQuery);
      return matchTitle || matchArtist || matchAlbum || matchGenre;
    });
  }

  /**
   * Generates offline home feed strictly from cached/downloaded items
   */
  public async getOfflineHomeFeed(): Promise<OfflineFeed> {
    const tracks = await this.getOfflineTracks();
    const vaultStats = await encryptedStorageService.getVaultStats();

    const artistsSet = new Set<string>();
    tracks.forEach((t) => {
      t.artist.split(',').forEach((a) => artistsSet.add(a.trim()));
    });

    return {
      downloadedTracks: tracks,
      quickPicks: tracks.slice(0, 6),
      topArtists: Array.from(artistsSet).slice(0, 5),
      vaultStats: {
        totalTracks: vaultStats.totalTracks,
        totalFormatted: vaultStats.totalFormatted,
        encryptionStandard: vaultStats.encryptionStandard
      }
    };
  }

  /**
   * Fast check if a track is stored in local database
   */
  public isAvailableOffline(trackId: string): boolean {
    return this.memoryCache.some((t) => t.id === trackId) || offlineService.isDownloaded(trackId);
  }
}

export const offlineDatabaseService = new OfflineDatabaseService();
