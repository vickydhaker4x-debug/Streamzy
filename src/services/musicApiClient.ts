import { Track, Album, Artist, ContextualSearchResults } from '../types';
import { TRACKS } from '../data/musicData';
import { extractAlbums, extractArtists } from './libraryDataService';

interface ClientCacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  hitCount: number;
}

// Client TTL configuration in milliseconds
export const CLIENT_CACHE_TTL = {
  SEARCH: 3 * 60 * 1000,          // 3 minutes
  SONG: 30 * 60 * 1000,           // 30 minutes
  ALBUM: 30 * 60 * 1000,          // 30 minutes
  ARTIST: 30 * 60 * 1000,         // 30 minutes
  RECOMMENDATIONS: 2 * 60 * 1000, // 2 minutes
  QUICK_PICKS: 3 * 60 * 1000,     // 3 minutes
  QUEUE: 20 * 1000,               // 20 seconds
  HISTORY: 45 * 1000              // 45 seconds
};

class MusicApiClient {
  private cache: Map<string, ClientCacheEntry<any>> = new Map();
  private inFlightRequests: Map<string, Promise<any>> = new Map();
  private maxCacheSize = 250;

  // Cache Telemetry
  private hits = 0;
  private misses = 0;

  constructor() {
    // Periodically evict expired entries
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanupExpired(), 45000);
    }
  }

  /**
   * Universal fetch with in-memory TTL caching, in-flight request deduplication, and resilient fallback
   */
  private async cachedFetch<T>(
    endpoint: string,
    ttlMs: number,
    fallbackFn?: () => T | Promise<T>,
    options?: RequestInit
  ): Promise<T> {
    const cacheKey = `${options?.method || 'GET'}:${endpoint}`;

    // 1. Check in-memory cache
    const existing = this.cache.get(cacheKey);
    const now = Date.now();
    if (existing && existing.expiresAt > now) {
      existing.hitCount++;
      this.hits++;
      return existing.data as T;
    }

    // 2. Check if identical request is currently in-flight
    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey) as Promise<T>;
    }

    this.misses++;

    // 3. Initiate request
    const requestPromise = (async () => {
      try {
        const response = await fetch(endpoint, options);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();

        // Evict LRU if cache exceeds limit
        if (this.cache.size >= this.maxCacheSize) {
          this.evictOldest();
        }

        // Store in cache
        this.cache.set(cacheKey, {
          data,
          cachedAt: now,
          expiresAt: now + ttlMs,
          hitCount: 0
        });

        return data as T;
      } catch (err) {
        console.warn(`[MusicApiClient] Network request failed for ${endpoint}, using fallback if available:`, err);
        if (fallbackFn) {
          return await fallbackFn();
        }
        throw err;
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  /**
   * GET /api/search
   */
  public async search(query: string, limit = 20): Promise<ContextualSearchResults | any> {
    const q = (query || '').trim();
    if (!q) {
      return {
        query: '',
        hasTypoCorrection: false,
        songs: [],
        albums: [],
        artists: [],
        playlists: []
      };
    }

    const endpoint = `/api/search?q=${encodeURIComponent(q)}&limit=${limit}`;
    return this.cachedFetch(
      endpoint,
      CLIENT_CACHE_TTL.SEARCH,
      () => {
        // Resilient fallback to client-side search engine catalog if backend unreachable
        const { searchEngine } = require('./searchEngine');
        return searchEngine.search(q);
      }
    );
  }

  /**
   * GET /api/songs/:id
   */
  public async getSong(id: string): Promise<Track | null> {
    const endpoint = `/api/songs/${encodeURIComponent(id)}`;
    return this.cachedFetch(
      endpoint,
      CLIENT_CACHE_TTL.SONG,
      () => {
        const found = TRACKS.find((t) => t.id === id || t.videoId === id);
        return found ? { status: 'ok', song: found } : null;
      }
    ).then((res: any) => res?.song || res || null);
  }

  /**
   * GET /api/songs
   */
  public async getAllSongs(genre?: string, limit = 50): Promise<Track[]> {
    const endpoint = `/api/songs?limit=${limit}${genre ? `&genre=${encodeURIComponent(genre)}` : ''}`;
    return this.cachedFetch(
      endpoint,
      CLIENT_CACHE_TTL.SONG,
      () => ({ status: 'ok', count: TRACKS.length, songs: TRACKS.slice(0, limit) })
    ).then((res: any) => res?.songs || []);
  }

  /**
   * GET /api/albums/:id
   */
  public async getAlbum(id: string): Promise<Album | null> {
    const endpoint = `/api/albums/${encodeURIComponent(id)}`;
    return this.cachedFetch(
      endpoint,
      CLIENT_CACHE_TTL.ALBUM,
      () => {
        const allAlbums = extractAlbums(TRACKS);
        const found = allAlbums.find((a) => a.id === id || a.title.toLowerCase() === id.toLowerCase());
        return found ? { status: 'ok', album: found } : null;
      }
    ).then((res: any) => res?.album || null);
  }

  /**
   * GET /api/artists/:id
   */
  public async getArtist(id: string): Promise<Artist | null> {
    const endpoint = `/api/artists/${encodeURIComponent(id)}`;
    return this.cachedFetch(
      endpoint,
      CLIENT_CACHE_TTL.ARTIST,
      () => {
        const allAlbums = extractAlbums(TRACKS);
        const allArtists = extractArtists(TRACKS, allAlbums);
        const found = allArtists.find((a) => a.id === id || a.name.toLowerCase() === id.toLowerCase());
        return found ? { status: 'ok', artist: found } : null;
      }
    ).then((res: any) => res?.artist || null);
  }

  /**
   * GET /api/recommendations
   */
  public async getRecommendations(
    seedId?: string,
    vibe?: string,
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night',
    limit = 15
  ) {
    const params = new URLSearchParams();
    if (seedId) params.set('seedId', seedId);
    if (vibe) params.set('vibe', vibe);
    if (timeOfDay) params.set('timeOfDay', timeOfDay);
    params.set('limit', limit.toString());

    const endpoint = `/api/recommendations?${params.toString()}`;
    return this.cachedFetch(
      endpoint,
      CLIENT_CACHE_TTL.RECOMMENDATIONS,
      () => ({
        vibe: vibe || 'trending',
        recommendations: TRACKS.slice(0, limit)
      })
    );
  }

  /**
   * GET /api/quick-picks
   */
  public async getQuickPicks(userId = 'default_user', timeOfDay?: any, clientHour?: number, limit = 16) {
    const params = new URLSearchParams({ userId, limit: limit.toString() });
    if (timeOfDay) params.set('timeOfDay', timeOfDay);
    if (clientHour !== undefined) params.set('clientHour', clientHour.toString());

    const endpoint = `/api/quick-picks?${params.toString()}`;
    return this.cachedFetch(
      endpoint,
      CLIENT_CACHE_TTL.QUICK_PICKS,
      () => ({
        tracks: TRACKS.slice(0, limit),
        cached: false
      })
    );
  }

  /**
   * GET /api/queue
   */
  public async getQueue(userId = 'default_user') {
    const endpoint = `/api/queue?userId=${encodeURIComponent(userId)}`;
    return this.cachedFetch(
      endpoint,
      CLIENT_CACHE_TTL.QUEUE,
      () => ({ status: 'ok', queue: null })
    );
  }

  /**
   * POST /api/queue
   */
  public async updateQueue(userId = 'default_user', payload: any) {
    this.invalidate(`GET:/api/queue?userId=${encodeURIComponent(userId)}`);
    try {
      const response = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...payload })
      });
      return await response.json();
    } catch (err) {
      console.warn('[MusicApiClient] Failed to post queue:', err);
      return { status: 'fallback', queue: payload };
    }
  }

  /**
   * GET /api/history
   */
  public async getHistory(userId = 'default_user', limit = 50) {
    const endpoint = `/api/history?userId=${encodeURIComponent(userId)}&limit=${limit}`;
    return this.cachedFetch(
      endpoint,
      CLIENT_CACHE_TTL.HISTORY,
      () => ({ status: 'ok', history: [] })
    );
  }

  /**
   * POST /api/history
   */
  public async recordHistory(userId = 'default_user', payload: any) {
    this.invalidate(`GET:/api/history?userId=${encodeURIComponent(userId)}`);
    this.invalidatePrefix(`GET:/api/quick-picks`);
    this.invalidatePrefix(`GET:/api/recommendations`);

    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...payload })
      });
      return await response.json();
    } catch (err) {
      console.warn('[MusicApiClient] Failed to record history:', err);
      return { status: 'fallback' };
    }
  }

  /**
   * DELETE /api/history
   */
  public async clearHistory(userId = 'default_user') {
    this.invalidate(`GET:/api/history?userId=${encodeURIComponent(userId)}`);
    this.invalidatePrefix(`GET:/api/quick-picks`);
    try {
      const response = await fetch(`/api/history?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE'
      });
      return await response.json();
    } catch (err) {
      console.warn('[MusicApiClient] Failed to clear history:', err);
      return { status: 'fallback' };
    }
  }

  /**
   * Cache Invalidation Methods
   */
  public invalidate(cacheKey: string) {
    this.cache.delete(cacheKey);
  }

  public invalidatePrefix(prefix: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  public invalidateSearch() {
    this.invalidatePrefix('/api/search');
  }

  public invalidateRecommendations() {
    this.invalidatePrefix('/api/recommendations');
    this.invalidatePrefix('/api/quick-picks');
  }

  public invalidateAll() {
    this.cache.clear();
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  private evictOldest() {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.cachedAt < oldestTime) {
        oldestTime = entry.cachedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Diagnostics & Cache Hit Rate stats
   */
  public getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) : '100.0';
    return {
      entriesCount: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
      maxSize: this.maxCacheSize
    };
  }
}

export const musicApiClient = new MusicApiClient();
