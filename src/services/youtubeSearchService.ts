import { Track } from '../types';
import { detectLanguage } from './musicNormalizationService';

export interface YouTubeSearchResponse {
  status: string;
  query: string;
  page: number;
  hasMore: boolean;
  nextPageToken?: string;
  topResult?: {
    type: 'song' | 'artist' | 'album';
    item: Track;
  } | null;
  songs: Track[];
  videos: Array<{
    id: string;
    videoId: string;
    title: string;
    artist: string;
    thumbnailUrl: string;
    views: string;
    duration: string;
  }>;
  artists: Array<{
    id: string;
    name: string;
    avatarUrl: string;
    tracks: Track[];
    trackCount: number;
    albumCount: number;
  }>;
  albums: any[];
  totalCount: number;
  apiSource?: 'official_youtube_api_v3' | 'backend_proxy' | 'client_direct_pipeline';
  auditLog?: string;
}

/**
 * Validates whether a given string is a valid YouTube video ID (11 standard characters)
 */
export function isValidYouTubeVideoId(videoId?: string | null): boolean {
  if (!videoId || typeof videoId !== 'string') return false;
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId.trim());
}

const clientSearchCache = new Map<string, { data: YouTubeSearchResponse; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Helper to format ISO 8601 duration (e.g. PT4M13S -> "4:13", PT1H2M30S -> "1:02:30")
function parseIsoDuration(isoDuration: string): { formatted: string; seconds: number } {
  if (!isoDuration) return { formatted: '3:30', seconds: 210 };
  const matches = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!matches) return { formatted: '3:30', seconds: 210 };
  const hours = parseInt(matches[1] || '0', 10);
  const minutes = parseInt(matches[2] || '0', 10);
  const seconds = parseInt(matches[3] || '0', 10);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  if (hours > 0) {
    return {
      formatted: `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`,
      seconds: totalSeconds
    };
  }
  return {
    formatted: `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`,
    seconds: totalSeconds
  };
}

// Clean title of video noise
function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return 'Untitled Song';
  return rawTitle
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\[\s*(Official\s*(Music\s*)?Video|Official\s*Audio|Lyric\s*Video|HD|4K|Audio)\s*\]/gi, '')
    .replace(/\(\s*(Official\s*(Music\s*)?Video|Official\s*Audio|Lyric\s*Video|HD|4K|Audio)\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Format views (e.g. 14500000 -> "14.5M views")
function formatViews(views?: number | string): string {
  if (!views) return 'YouTube Music';
  const num = typeof views === 'string' ? parseInt(views.replace(/[^0-9]/g, ''), 10) : views;
  if (isNaN(num)) return typeof views === 'string' ? views : 'YouTube Music';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B views`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M views`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K views`;
  return `${num} views`;
}

// Clean artist name
function cleanArtist(rawArtist?: string, title?: string): string {
  if (!rawArtist) {
    if (title && title.includes('-')) {
      return title.split('-')[0].trim();
    }
    return 'YouTube Artist';
  }
  return rawArtist
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .trim();
}

class YouTubeSearchService {
  /**
   * Search songs using the official YouTube Data API v3 with resilient multi-tier fallback
   */
  async search(
    query: string,
    page: number = 1,
    limit: number = 20,
    signal?: AbortSignal,
    pageToken?: string
  ): Promise<YouTubeSearchResponse> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        status: 'ok',
        query: '',
        page: 1,
        hasMore: false,
        topResult: null,
        songs: [],
        videos: [],
        artists: [],
        albums: [],
        totalCount: 0
      };
    }

    const cacheKey = `${trimmed.toLowerCase()}_p${page}_l${limit}_${pageToken || ''}`;
    const cached = clientSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[YouTubeSearchService] ⚡ Cache HIT for "${trimmed}" (page ${page})`);
      return cached.data;
    }

    const apiKey =
      (import.meta as any).env?.VITE_YOUTUBE_API_KEY ||
      localStorage.getItem('vd_custom_yt_key') ||
      '';

    // -------------------------------------------------------------
    // Tier 1: Official YouTube Data API v3 (Direct Client Request)
    // -------------------------------------------------------------
    if (apiKey) {
      console.log(`[YouTubeSearchService] Attempting Official YouTube Data API v3 search for: "${trimmed}"`);
      try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&maxResults=${limit}&q=${encodeURIComponent(
          trimmed + ' music'
        )}&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ''}`;

        const searchRes = await fetch(searchUrl, { signal });
        if (!searchRes.ok) {
          const errData = await searchRes.json().catch(() => ({}));
          console.error(
            `[YouTube API Audit] HTTP ${searchRes.status} Error:`,
            errData?.error?.message || searchRes.statusText,
            'Reason:',
            errData?.error?.errors?.[0]?.reason || 'Unknown'
          );
          throw new Error(`YouTube API returned HTTP ${searchRes.status}`);
        }

        const searchData = await searchRes.json();
        const videoIds = (searchData.items || [])
          .map((item: any) => item.id?.videoId)
          .filter(Boolean)
          .join(',');

        let enrichedItems: any[] = [];
        let nextPageToken = searchData.nextPageToken;

        if (videoIds) {
          const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,statistics&id=${videoIds}&key=${apiKey}`;
          const detailsRes = await fetch(detailsUrl, { signal });
          if (detailsRes.ok) {
            const detailsData = await detailsRes.json();
            enrichedItems = (detailsData.items || []).map((v: any) => {
              const parsedDuration = parseIsoDuration(v.contentDetails?.duration);
              return {
                id: `yt-${v.id}`,
                videoId: v.id,
                title: cleanTitle(v.snippet?.title || ''),
                artist: cleanArtist(v.snippet?.channelTitle, v.snippet?.title),
                album: 'YouTube Music',
                duration: parsedDuration.formatted,
                durationSec: parsedDuration.seconds,
                coverUrl:
                  v.snippet?.thumbnails?.high?.url ||
                  v.snippet?.thumbnails?.medium?.url ||
                  `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
                views: formatViews(v.statistics?.viewCount),
                source: 'youtube' as const,
                quality: 'YouTube Audio (Official Player)',
                isFavorite: false
              };
            });
          }
        }

        if (enrichedItems.length > 0) {
          const payload = this.buildSearchPayload(trimmed, page, enrichedItems, nextPageToken, 'official_youtube_api_v3');
          clientSearchCache.set(cacheKey, { data: payload, timestamp: Date.now() });
          return payload;
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || signal?.aborted) throw err;
        console.warn('[YouTubeSearchService] Official API failed, continuing to secondary pipeline:', err.message);
      }
    } else {
      console.log('[YouTubeSearchService] VITE_YOUTUBE_API_KEY not configured, using resilient YouTube Music search pipeline');
    }

    // -------------------------------------------------------------
    // Tier 2: Backend Proxy (/api/youtube/search with yt-search)
    // -------------------------------------------------------------
    try {
      console.log(`[YouTubeSearchService] Querying backend YouTube search proxy for: "${trimmed}"`);
      const backendUrl = `/api/youtube/search?q=${encodeURIComponent(trimmed)}&page=${page}&limit=${limit}`;
      const res = await fetch(backendUrl, { signal });
      if (res.ok) {
        const data: YouTubeSearchResponse = await res.json();
        if (data.status === 'ok' && (data.songs?.length > 0 || data.videos?.length > 0)) {
          console.log(`[YouTubeSearchService] Backend proxy returned ${data.songs.length} results`);
          clientSearchCache.set(cacheKey, { data, timestamp: Date.now() });
          return {
            ...data,
            apiSource: 'backend_proxy'
          };
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) throw err;
      console.warn('[YouTubeSearchService] Backend proxy unavailable (typical in standalone APK without local server):', err.message);
    }

    // -------------------------------------------------------------
    // Tier 3: Client-side Direct YouTube Music Pipeline (for Standalone APKs)
    // -------------------------------------------------------------
    try {
      console.log(`[YouTubeSearchService] Executing standalone client-side YouTube Music search for: "${trimmed}"`);
      const directUrl = `https://pipedapi.ducks.party/search?q=${encodeURIComponent(trimmed)}&filter=music_songs`;
      const directRes = await fetch(directUrl, { signal });
      if (directRes.ok) {
        const data = await directRes.json();
        const items = data.items || [];
        if (items.length > 0) {
          const songs: Track[] = items.slice(0, limit).map((item: any) => {
            const videoId = (item.url || '').replace('/watch?v=', '') || Math.random().toString(36).substring(2, 9);
            const durationSec = typeof item.duration === 'number' ? item.duration : 210;
            const mins = Math.floor(durationSec / 60);
            const secs = durationSec % 60;
            const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

            return {
              id: `yt-${videoId}`,
              videoId,
              title: cleanTitle(item.title || 'YouTube Song'),
              artist: cleanArtist(item.uploaderName, item.title),
              album: 'YouTube Music',
              duration: durationStr,
              durationSec,
              coverUrl: item.thumbnail || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
              views: formatViews(item.views),
              source: 'youtube' as const,
              quality: 'YouTube Audio (Official Player)',
              isFavorite: false
            };
          });

          const payload = this.buildSearchPayload(
            trimmed,
            page,
            songs,
            items.length >= limit ? `page_${page + 1}` : undefined,
            'client_direct_pipeline'
          );
          clientSearchCache.set(cacheKey, { data: payload, timestamp: Date.now() });
          return payload;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) throw err;
      console.warn('[YouTubeSearchService] Direct client search failed:', err.message);
    }

    // If all pipelines returned no results or failed
    return {
      status: 'ok',
      query: trimmed,
      page,
      hasMore: false,
      topResult: null,
      songs: [],
      videos: [],
      artists: [],
      albums: [],
      totalCount: 0,
      auditLog: 'No online YouTube tracks found matching the given keywords.'
    };
  }

  private buildSearchPayload(
    query: string,
    page: number,
    songs: Track[],
    nextPageToken?: string,
    apiSource?: 'official_youtube_api_v3' | 'backend_proxy' | 'client_direct_pipeline'
  ): YouTubeSearchResponse {
    const topResult = songs.length > 0 ? { type: 'song' as const, item: songs[0] } : null;

    const videos = songs.map((t) => ({
      id: t.videoId || t.id,
      videoId: t.videoId || t.id,
      title: t.title,
      artist: t.artist,
      thumbnailUrl: t.coverUrl,
      views: t.views || 'YouTube Music',
      duration: t.duration
    }));

    const artistMap = new Map<string, Track[]>();
    songs.forEach((s) => {
      if (!artistMap.has(s.artist)) {
        artistMap.set(s.artist, []);
      }
      artistMap.get(s.artist)!.push(s);
    });

    const artists = Array.from(artistMap.entries())
      .slice(0, 4)
      .map(([name, tracks], idx) => ({
        id: `yt-art-${idx}-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        name,
        avatarUrl: tracks[0]?.coverUrl || '/streamzy_logo.jpg',
        tracks,
        trackCount: tracks.length,
        albumCount: 1
      }));

    return {
      status: 'ok',
      query,
      page,
      hasMore: Boolean(nextPageToken),
      nextPageToken,
      topResult,
      songs,
      videos,
      artists,
      albums: [],
      totalCount: songs.length,
      apiSource
    };
  }

  clearCache() {
    clientSearchCache.clear();
  }

  /**
   * Fetches real related tracks matching exact language, genre, vibe, and style using YouTube Data API v3
   */
  async getSmartRelatedTracks(seedTrack: Track, limit: number = 20): Promise<Track[]> {
    if (!seedTrack) return [];
    const seedArtist = cleanArtist(seedTrack.artist, seedTrack.title);
    const cleanSeedTitle = cleanTitle(seedTrack.title);
    const targetLang = (seedTrack.language || detectLanguage(seedTrack.title, seedTrack.artist, seedTrack.genre, seedTrack.album)).toLowerCase();

    // Build intelligent language-anchored stylistic search queries
    const queries: string[] = [];

    if (targetLang === 'hindi') {
      queries.push(
        `${cleanSeedTitle} hindi song`,
        `${seedArtist} hindi hit songs`,
        `${cleanSeedTitle} bollywood lofi mix`,
        `${seedArtist} similar hindi artists playlist`
      );
    } else if (targetLang === 'punjabi') {
      queries.push(
        `${cleanSeedTitle} punjabi song`,
        `${seedArtist} punjabi hit songs`,
        `${seedArtist} punjabi latest mix`
      );
    } else if (targetLang === 'tamil') {
      queries.push(
        `${cleanSeedTitle} tamil song`,
        `${seedArtist} tamil hit songs`
      );
    } else if (targetLang === 'telugu') {
      queries.push(
        `${cleanSeedTitle} telugu song`,
        `${seedArtist} telugu hit songs`
      );
    } else if (targetLang === 'k-pop') {
      queries.push(
        `${cleanSeedTitle} kpop song`,
        `${seedArtist} kpop songs`
      );
    } else if (targetLang === 'spanish') {
      queries.push(
        `${cleanSeedTitle} spanish song`,
        `${seedArtist} latin mix`
      );
    } else {
      // English / Western
      queries.push(
        `${cleanSeedTitle} ${seedArtist} song`,
        `${cleanSeedTitle} radio mix pop`,
        `${seedArtist} similar artists songs`
      );
    }

    const results: Track[] = [];
    const seenKeys = new Set<string>();

    for (const q of queries) {
      try {
        const res = await this.search(q, 1, 12);
        if (res && Array.isArray(res.songs)) {
          for (const s of res.songs) {
            if (s && s.videoId && s.videoId !== seedTrack.videoId && s.id !== seedTrack.id) {
              // Strict Language Validation: Candidate must match seed language
              const sLang = (s.language || detectLanguage(s.title, s.artist, s.genre, s.album)).toLowerCase();
              if (sLang !== targetLang) {
                continue; // Skip wrong-language songs
              }

              const key = `${cleanTitle(s.title).toLowerCase()}|${cleanArtist(s.artist, s.title).toLowerCase()}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                results.push({
                  ...s,
                  language: s.language || seedTrack.language || targetLang.charAt(0).toUpperCase() + targetLang.slice(1)
                });
              }
            }
          }
        }
      } catch {}
      if (results.length >= limit) break;
    }

    return results.slice(0, limit);
  }
}

export const youtubeSearchService = new YouTubeSearchService();
