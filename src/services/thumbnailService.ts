import { Track } from '../types';

/**
 * High-performance Thumbnail & Artwork Cache + Preloader Engine
 * 
 * - Pre-loads images into browser cache before songs are played or queued
 * - Resolves missing/broken thumbnails dynamically via high-res iTunes artwork
 * - Persists verified covers in memory and localStorage for instant 0ms retrieval
 */

class ThumbnailService {
  private cache: Map<string, string> = new Map();
  private failedSet: Set<string> = new Set();
  private pendingResolutions: Map<string, Promise<string | null>> = new Map();
  private preloadedUrls: Set<string> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('vd_art_cache_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([k, v]) => {
          if (typeof v === 'string') this.cache.set(k, v);
        });
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveToStorage() {
    try {
      const obj: Record<string, string> = {};
      let count = 0;
      for (const [k, v] of this.cache.entries()) {
        obj[k] = v;
        count++;
        if (count > 250) break; // keep cache compact
      }
      localStorage.setItem('vd_art_cache_v2', JSON.stringify(obj));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Return candidate image URLs for a track in order of visual quality
   */
  public getCandidateUrls(track: { coverUrl?: string; videoId?: string; id?: string; title?: string; artist?: string }): string[] {
    const urls: string[] = [];

    // 1. Cached resolved cover (e.g. from previous verified fetch)
    const cacheKey = this.getCacheKey(track);
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (!urls.includes(cached)) urls.push(cached);
    }

    // 2. Explicit coverUrl provided on track (e.g. JioSaavn / iTunes / CDN)
    if (track.coverUrl && !urls.includes(track.coverUrl)) {
      urls.push(track.coverUrl.replace('/hqdefault.jpg', '/mqdefault.jpg'));
    }

    // 3. Ultra-fast, guaranteed YouTube thumbnail (mqdefault is always 200 OK & 16:9, loads in <60ms)
    if (track.videoId) {
      urls.push(`https://i.ytimg.com/vi/${track.videoId}/mqdefault.jpg`);
      urls.push(`https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`);
    }

    // 4. Default Streamzy branded logo fallback
    urls.push('/streamzy_logo.jpg');

    return urls;
  }

  public getCacheKey(track: { id?: string; videoId?: string; title?: string; artist?: string }): string {
    if (track.id) return track.id;
    if (track.videoId) return `yt_${track.videoId}`;
    return `${track.title || ''}_${track.artist || ''}`.toLowerCase().trim();
  }

  public getCachedCover(track: { id?: string; videoId?: string; title?: string; artist?: string }): string | null {
    const key = this.getCacheKey(track);
    return this.cache.get(key) || null;
  }

  public setCachedCover(track: { id?: string; videoId?: string; title?: string; artist?: string }, url: string) {
    const key = this.getCacheKey(track);
    this.cache.set(key, url);
    this.saveToStorage();
  }

  /**
   * Pre-fetches an image into the browser's HTTP/memory cache
   */
  public preloadImageUrl(url: string): Promise<boolean> {
    if (!url || this.preloadedUrls.has(url)) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        this.preloadedUrls.add(url);
        resolve(true);
      };
      img.onerror = () => {
        resolve(false);
      };
      img.src = url;
    });
  }

  /**
   * Dynamically fetch HD album artwork from iTunes search if YouTube thumbnail is missing/broken
   */
  public async resolveHdArtwork(track: { title: string; artist: string; id?: string }): Promise<string | null> {
    const cacheKey = this.getCacheKey(track);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    if (this.failedSet.has(cacheKey)) {
      return null;
    }
    if (this.pendingResolutions.has(cacheKey)) {
      return this.pendingResolutions.get(cacheKey)!;
    }

    const resolutionPromise = (async () => {
      try {
        const query = `${track.title} ${track.artist}`.replace(/\(.*?\)/g, '').trim();
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`;
        
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            const rawArt = data.results[0].artworkUrl100 || data.results[0].artworkUrl60;
            if (rawArt) {
              const hdArt = rawArt.replace('100x100bb.jpg', '600x600bb.jpg');
              this.cache.set(cacheKey, hdArt);
              this.saveToStorage();
              // Preload the resolved image
              this.preloadImageUrl(hdArt);
              return hdArt;
            }
          }
        }
      } catch {
        // Handled silently
      }

      this.failedSet.add(cacheKey);
      return null;
    })();

    this.pendingResolutions.set(cacheKey, resolutionPromise);
    const result = await resolutionPromise;
    this.pendingResolutions.delete(cacheKey);
    return result;
  }

  /**
   * Pre-fetches thumbnails for all tracks in an array (e.g. upcoming queue)
   * Runs non-blockingly in the background
   */
  public preloadTracks(tracks: Track[], limit: number = 15) {
    const toPreload = tracks.slice(0, limit);

    toPreload.forEach(async (track, index) => {
      // Stagger fetches slightly so network stays silky smooth
      setTimeout(async () => {
        const candidates = this.getCandidateUrls(track);
        let loaded = false;

        for (const url of candidates) {
          if (url === '/streamzy_logo.jpg') continue;
          const ok = await this.preloadImageUrl(url);
          if (ok) {
            this.setCachedCover(track, url);
            loaded = true;
            break;
          }
        }

        // If all standard candidates failed, automatically resolve HD artwork before track plays!
        if (!loaded && track.title) {
          await this.resolveHdArtwork(track);
        }
      }, index * 80);
    });
  }
}

export const thumbnailService = new ThumbnailService();
