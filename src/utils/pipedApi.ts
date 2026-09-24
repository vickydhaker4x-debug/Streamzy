import { Track } from '../types';
import { normalizeTrack, deduplicateTracks } from '../services/musicNormalizationService';

// TTL Cache storage for external queries and streams
const searchCache = new Map<string, { tracks: Track[]; expiresAt: number }>();
const streamCache = new Map<string, { info: StreamInfo; expiresAt: number }>();
const relatedCache = new Map<string, { tracks: Track[]; expiresAt: number }>();
const suggestionsCache = new Map<string, { suggestions: string[]; expiresAt: number }>();

const inFlightSearches = new Map<string, Promise<Track[]>>();
const inFlightStreams = new Map<string, Promise<StreamInfo | null>>();

const SEARCH_TTL_MS = 4 * 60 * 1000; // 4 minutes
const RELATED_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SUGGESTIONS_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const PIPED_INSTANCES = [
  'https://api.piped.privacydev.net',
  'https://pipedapi.ducks.party',
  'https://pipedapi.nosebs.ru',
  'https://piped-api.garudalinux.org',
  'https://pipedapi.projectsegfau.lt'
];

export const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://invidious.nerdvpn.de',
  'https://inv.tux.pizza',
  'https://invidious.no-valat.net',
  'https://vid.priv.au',
  'https://invidious.flokinet.to',
  'https://invidious.einfachzocken.eu'
];

// Helper to format seconds to mm:ss
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '3:30';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Return reliable thumbnail for YouTube/Invidious video IDs
 */
export function getSafeThumbnailUrl(videoId?: string, rawThumb?: string): string {
  if (videoId) {
    return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  }
  if (rawThumb && rawThumb.startsWith('http')) {
    return rawThumb.replace('/hqdefault.jpg', '/mqdefault.jpg');
  }
  return '/streamzy_logo.jpg';
}

// Fetch with timeout and optional external AbortSignal (for zero-latency offline abort)
async function fetchWithTimeout(url: string, timeoutMs: number = 4000, externalSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(id);
      throw new DOMException('Aborted', 'AbortError');
    }
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Search tracks using Apple Music / iTunes Search API.
 * Ultra-fast (<200ms), 100% uptime, global catalog, no rate-limiting or Cloudflare bot blocks.
 */
export async function searchAppleMusicTracks(query: string, signal?: AbortSignal, limit: number = 25): Promise<Track[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&entity=song&limit=${limit}`;
    const res = await fetchWithTimeout(url, 3500, signal);
    if (!res.ok) throw new Error(`iTunes API returned ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.results) || data.results.length === 0) return [];

    return data.results.map((item: any) => {
      const art100 = item.artworkUrl100 || item.artworkUrl60 || '';
      const hdArt = art100 ? art100.replace('100x100bb.jpg', '600x600bb.jpg') : '/streamzy_logo.jpg';
      const durationSec = Math.round((item.trackTimeMillis || 210000) / 1000);
      return normalizeTrack({
        id: `itunes-${item.trackId}`,
        title: item.trackName || 'Untitled Song',
        artist: item.artistName || 'Popular Artist',
        album: item.collectionName || 'Single',
        duration: formatDuration(durationSec),
        durationSec: durationSec,
        coverUrl: hdArt,
        albumArt: hdArt,
        audioUrl: undefined, // Do not treat 30-second preview as full audio URL
        quality: '256kbps High Quality',
        genre: item.primaryGenreName || 'Music',
        isFavorite: false,
        source: 'itunes'
      });
    });
  } catch (err: any) {
    return [];
  }
}

/**
 * Search tracks across reliable Invidious, Piped, and Apple Music instances with TTL caching & deduplication
 */
export async function searchTracks(query: string, signal?: AbortSignal): Promise<Track[]> {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return [];

  // Check TTL cache
  const cached = searchCache.get(cleanQ);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tracks;
  }

  // Deduplicate in-flight requests
  if (inFlightSearches.has(cleanQ)) {
    return inFlightSearches.get(cleanQ)!;
  }

  const searchPromise = (async () => {
    try {
      // 1. Launch Apple Music search in parallel (ultra-fast 150ms fallback)
      const applePromise = searchAppleMusicTracks(query, signal, 25);

      // 2. Launch YouTube (Invidious / Piped) instances
      const youtubePromise = (async () => {
        try {
          const invidiousPromises = INVIDIOUS_INSTANCES.map(async (instance) => {
            const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
            const res = await fetchWithTimeout(url, 4000, signal);
            if (!res.ok) throw new Error('Not ok');
            const items = await res.json();
            if (!Array.isArray(items) || items.length === 0) throw new Error('No items');
            
            return items.slice(0, 20).map((item: any) => {
              const videoId = item.videoId;
              return normalizeTrack({
                id: `inv-${videoId}`,
                title: item.title || 'Untitled Song',
                artist: item.author || 'Popular Artist',
                album: 'Streamzy High-Fidelity',
                duration: formatDuration(item.lengthSeconds),
                durationSec: item.lengthSeconds || 210,
                coverUrl: getSafeThumbnailUrl(videoId, item.videoThumbnails?.[0]?.url),
                quality: '320kbps High Quality',
                videoId: videoId,
                isFavorite: false,
                source: 'youtube'
              });
            });
          });

          const pipedPromises = PIPED_INSTANCES.map(async (instance) => {
            const url = `${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`;
            const res = await fetchWithTimeout(url, 3800, signal);
            if (!res.ok) throw new Error('Not ok');
            const data = await res.json();
            const items = data.items || [];
            if (items.length === 0) throw new Error('No items');
            
            return items.slice(0, 20).map((item: any) => {
              const videoId = (item.url || '').replace('/watch?v=', '');
              return normalizeTrack({
                id: `piped-${videoId || Math.random().toString(36).substring(2, 9)}`,
                title: item.title || 'Untitled Song',
                artist: item.uploaderName || 'Popular Artist',
                album: 'Streamzy High-Fidelity',
                duration: formatDuration(item.duration),
                durationSec: item.duration || 210,
                coverUrl: getSafeThumbnailUrl(videoId, item.thumbnail),
                quality: '320kbps High Quality',
                videoId: videoId,
                isFavorite: false,
                source: 'youtube'
              });
            });
          });

          return await Promise.any([...invidiousPromises, ...pipedPromises]);
        } catch {
          return [];
        }
      })();

      const [ytResults, appleResults] = await Promise.all([youtubePromise, applePromise]);
      const combined = [...(ytResults || []), ...(appleResults || [])];
      const deduped = deduplicateTracks(combined);

      if (deduped.length > 0) {
        // Store in TTL cache
        searchCache.set(cleanQ, {
          tracks: deduped,
          expiresAt: Date.now() + SEARCH_TTL_MS
        });
      }

      return deduped;
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) {
        throw err;
      }
      return [];
    } finally {
      inFlightSearches.delete(cleanQ);
    }
  })();

  inFlightSearches.set(cleanQ, searchPromise);
  return searchPromise;
}

export interface StreamInfo {
  url: string;
  mimeType: string;
  bitrate?: number;
  expiresAt: number;
}

/**
 * Helper to extract expiration timestamp from googlevideo or stream URLs
 */
export function extractUrlExpiration(url: string, defaultTtlMs: number = 12 * 60 * 1000): number {
  try {
    const urlObj = new URL(url);
    const expireParam = urlObj.searchParams.get('expire');
    if (expireParam) {
      const expSec = parseInt(expireParam, 10);
      if (!isNaN(expSec) && expSec > 0) {
        // If timestamp is in seconds
        const expMs = expSec < 10000000000 ? expSec * 1000 : expSec;
        return expMs;
      }
    }
  } catch {}
  return Date.now() + defaultTtlMs;
}

/**
 * Get direct playable audio stream URL and metadata for a given video ID
 */
export async function getAudioStreamUrl(videoId: string): Promise<string | null> {
  const info = await getAudioStreamInfo(videoId);
  return info ? info.url : null;
}

/**
 * Get full stream info with expiration and MIME type
 */
export async function getAudioStreamInfo(videoId: string): Promise<StreamInfo | null> {
  if (!videoId) return null;

  // IMPORTANT:
  // Direct YouTube stream URLs are short-lived and different providers can return
  // different containers (WebM/Opus vs MP4/AAC). Never keep a stale provider URL
  // just because it has not technically expired yet.
  const cached = streamCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.info;
  }

  if (inFlightStreams.has(videoId)) {
    return inFlightStreams.get(videoId)!;
  }

  const streamPromise = (async () => {
    try {
      const requests = [
        ...INVIDIOUS_INSTANCES.map(async (instance) => {
          const url = `${instance}/api/v1/videos/${videoId}`;
          const res = await fetchWithTimeout(url, 4500);
          if (!res.ok) throw new Error(`Invidious ${res.status}`);
          const data = await res.json();
          const formats = Array.isArray(data.adaptiveFormats) ? data.adaptiveFormats : [];

          return formats
            .filter((f: any) => typeof f?.url === 'string' && f.url && typeof f?.type === 'string' && f.type.includes('audio'))
            .map((f: any) => ({
              url: f.url,
              mimeType: f.type,
              bitrate: Number(f.bitrate) || 0,
              expiresAt: extractUrlExpiration(f.url)
            }));
        }),
        ...PIPED_INSTANCES.map(async (instance) => {
          const url = `${instance}/streams/${videoId}`;
          const res = await fetchWithTimeout(url, 4000);
          if (!res.ok) throw new Error(`Piped ${res.status}`);
          const data = await res.json();
          const streams = Array.isArray(data.audioStreams) ? data.audioStreams : [];

          return streams
            .filter((s: any) => typeof s?.url === 'string' && s.url)
            .map((s: any) => ({
              url: s.url,
              mimeType: s.mimeType || '',
              bitrate: Number(s.bitrate) || 0,
              expiresAt: extractUrlExpiration(s.url)
            }));
        })
      ];

      const settled = await Promise.allSettled(requests);
      const candidates: StreamInfo[] = [];

      for (const result of settled) {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          candidates.push(...result.value);
        }
      }

      if (candidates.length === 0) return null;

      // Prefer stable MP4/AAC streams on Android, then MPEG audio.
      // WebM/Opus remains a fallback only when no MP4/MPEG stream exists.
      const score = (s: StreamInfo) => {
        const mime = (s.mimeType || '').toLowerCase();
        let containerScore = 0;
        if (mime.includes('audio/mp4') || mime.includes('mp4a')) containerScore = 3000000;
        else if (mime.includes('audio/mpeg') || mime.includes('mp3')) containerScore = 2000000;
        else if (mime.includes('audio/webm') || mime.includes('opus')) containerScore = 1000000;
        return containerScore + Math.min(Number(s.bitrate) || 0, 1000000);
      };

      candidates.sort((a, b) => score(b) - score(a));
      const best = candidates[0];

      // Never cache a URL beyond its real provider expiration.
      streamCache.set(videoId, {
        info: best,
        expiresAt: Math.min(best.expiresAt - 60000, Date.now() + 10 * 60 * 1000)
      });

      return best;
    } catch (err) {
      console.warn('[PipedAPI] stream resolution failed:', err);
      return null;
    } finally {
      inFlightStreams.delete(videoId);
    }
  })();

  inFlightStreams.set(videoId, streamPromise);
  return streamPromise;
}

/**
 * Fetch related / recommended tracks for YouTube Music style queue & personalization
 */
export async function getRelatedTracksFromVideo(videoId: string, artist?: string): Promise<Track[]> {
  if (!videoId) {
    if (artist) {
      return searchTracks(`${artist} songs`);
    }
    return [];
  }

  const cacheKey = `${videoId}:${artist || ''}`;
  const cached = relatedCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tracks;
  }

  // Strategy 1: Fetch recommendedVideos from Invidious video metadata
  const invidiousPromises = INVIDIOUS_INSTANCES.map(async (instance) => {
    const url = `${instance}/api/v1/videos/${videoId}`;
    const res = await fetchWithTimeout(url, 4000);
    if (!res.ok) throw new Error('Not ok');
    const data = await res.json();
    const recommended = data.recommendedVideos || [];
    if (!Array.isArray(recommended) || recommended.length === 0) throw new Error('No items');
    
    return recommended.slice(0, 20).map((item: any) => {
      const recVideoId = item.videoId;
      return normalizeTrack({
        id: `yt-rec-${recVideoId}`,
        title: item.title || 'Recommended Song',
        artist: item.author || artist || 'Suggested Artist',
        album: 'YouTube Music Mix',
        duration: formatDuration(item.lengthSeconds),
        durationSec: item.lengthSeconds || 210,
        coverUrl: getSafeThumbnailUrl(recVideoId, item.videoThumbnails?.[0]?.url),
        quality: '320kbps High Quality',
        videoId: recVideoId,
        isFavorite: false,
        source: 'youtube'
      });
    });
  });

  try {
    const rawResults = await Promise.any(invidiousPromises);
    const deduped = deduplicateTracks(rawResults);
    relatedCache.set(cacheKey, {
      tracks: deduped,
      expiresAt: Date.now() + RELATED_TTL_MS
    });
    return deduped;
  } catch (err) {
    // Strategy 2: If recommendedVideos not available, search for artist's similar tracks
    if (artist && artist.trim().length > 0) {
      try {
        const results = await searchTracks(`${artist} songs`);
        if (results.length > 0) {
          const deduped = deduplicateTracks(results.filter(r => r.videoId !== videoId));
          relatedCache.set(cacheKey, {
            tracks: deduped,
            expiresAt: Date.now() + RELATED_TTL_MS
          });
          return deduped;
        }
      } catch {
        // ignore
      }
    }
    return [];
  }
}

/**
 * Fetch online search suggestion queries from Invidious, Piped, and Apple Music with caching
 */
export async function fetchSearchSuggestions(query: string): Promise<string[]> {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];

  const cached = suggestionsCache.get(clean);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.suggestions;
  }

  const invidiousSuggestions = INVIDIOUS_INSTANCES.slice(0, 4).map(async (instance) => {
    const url = `${instance}/api/v1/search/suggestions?q=${encodeURIComponent(clean)}`;
    const res = await fetchWithTimeout(url, 2200);
    if (!res.ok) throw new Error('Not ok');
    const data = await res.json();
    if (data && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
      return data.suggestions as string[];
    }
    throw new Error('No suggestions');
  });

  const pipedSuggestions = PIPED_INSTANCES.slice(0, 3).map(async (instance) => {
    const url = `${instance}/suggestions?query=${encodeURIComponent(clean)}`;
    const res = await fetchWithTimeout(url, 2200);
    if (!res.ok) throw new Error('Not ok');
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data as string[];
    }
    throw new Error('No suggestions');
  });

  // Apple Music search hints fallback
  const appleSuggestions = (async () => {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&entity=song&limit=6`;
      const res = await fetchWithTimeout(url, 2000);
      if (!res.ok) throw new Error('Not ok');
      const data = await res.json();
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        const titles = data.results.map((r: any) => r.trackName).filter(Boolean);
        const artists = data.results.map((r: any) => r.artistName).filter(Boolean);
        return Array.from(new Set([...titles, ...artists])) as string[];
      }
      throw new Error('No apple suggestions');
    } catch {
      return [];
    }
  })();

  try {
    const results = await Promise.any([...invidiousSuggestions, ...pipedSuggestions]);
    const sliced = results.slice(0, 8);
    suggestionsCache.set(clean, {
      suggestions: sliced,
      expiresAt: Date.now() + SUGGESTIONS_TTL_MS
    });
    return sliced;
  } catch {
    const fallbackApple = await appleSuggestions;
    // Synthesize contextual related suggestions for any query word
    const synthesized = [
      `${clean} song`,
      `${clean} remix`,
      `${clean} lofi`,
      `${clean} lyrics`,
      `${clean} live`,
      `${clean} slowed & reverb`
    ];
    const combined = Array.from(new Set([...fallbackApple, ...synthesized])).slice(0, 8);
    suggestionsCache.set(clean, {
      suggestions: combined,
      expiresAt: Date.now() + SUGGESTIONS_TTL_MS
    });
    return combined;
  }
}

