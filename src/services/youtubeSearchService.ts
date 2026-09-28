import { Track } from '../types';

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
}

const clientSearchCache = new Map<string, { data: YouTubeSearchResponse; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class YouTubeSearchService {
  /**
   * Search songs using the official YouTube Data API / YouTube Music backend
   */
  async search(
    query: string,
    page: number = 1,
    limit: number = 20,
    signal?: AbortSignal
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

    const cacheKey = `${trimmed.toLowerCase()}_p${page}_l${limit}`;
    const cached = clientSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const url = `/api/youtube/search?q=${encodeURIComponent(trimmed)}&page=${page}&limit=${limit}`;
      const res = await fetch(url, { signal });
      if (!res.ok) {
        throw new Error(`YouTube search failed with status ${res.status}`);
      }

      const data: YouTubeSearchResponse = await res.json();
      
      // Store in fast memory cache
      clientSearchCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) {
        throw err;
      }
      console.warn('[YouTubeSearchService] Search error:', err);
      return {
        status: 'error',
        query: trimmed,
        page,
        hasMore: false,
        topResult: null,
        songs: [],
        videos: [],
        artists: [],
        albums: [],
        totalCount: 0
      };
    }
  }

  /**
   * Clear in-memory client search cache
   */
  clearCache() {
    clientSearchCache.clear();
  }
}

export const youtubeSearchService = new YouTubeSearchService();
