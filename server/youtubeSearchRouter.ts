import { Router, Request, Response } from 'express';
import ytSearch from 'yt-search';

export const youtubeSearchRouter = Router();

// In-memory TTL cache
interface CacheEntry {
  data: any;
  expiresAt: number;
}
const searchCache = new Map<string, CacheEntry>();
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

// Clean titles from common noise while keeping essential song names
function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return 'Untitled Track';
  return rawTitle
    .replace(/\[\s*(Official\s*(Music\s*)?Video|Official\s*Audio|Lyric\s*Video|HD|4K|Audio)\s*\]/gi, '')
    .replace(/\(\s*(Official\s*(Music\s*)?Video|Official\s*Audio|Lyric\s*Video|HD|4K|Audio)\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Format views (e.g. 14500000 -> "14.5M views")
function formatViews(views?: number): string {
  if (!views || isNaN(views)) return 'YouTube Music';
  if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1)}B views`;
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K views`;
  return `${views} views`;
}

// Clean channel name from Topic suffixes
function cleanArtistName(rawArtist?: string, title?: string): string {
  if (!rawArtist) {
    if (title && title.includes('-')) {
      return title.split('-')[0].trim();
    }
    return 'YouTube Artist';
  }
  return rawArtist.replace(/\s*-\s*Topic$/i, '').trim();
}

/**
 * GET /api/youtube/search
 * Official YouTube Data API v3 & YouTube Music search engine with pagination and caching
 */
youtubeSearchRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const query = ((req.query.q as string) || '').trim();
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 50);
    const category = (req.query.category as string) || 'all'; // all, songs, videos, artists, albums

    if (!query) {
      return res.json({
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
      });
    }

    const cacheKey = `yt_search:${query.toLowerCase()}:${category}:${page}:${limit}`;
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.data);
    }

    const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
    let items: any[] = [];
    let nextPageToken: string | undefined = undefined;

    // 1. Try Official YouTube Data API v3 if API key is provided
    if (apiKey) {
      try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&maxResults=${limit}&q=${encodeURIComponent(
          query + ' music'
        )}&key=${apiKey}${req.query.pageToken ? `&pageToken=${req.query.pageToken}` : ''}`;
        
        const ytRes = await fetch(searchUrl);
        if (ytRes.ok) {
          const ytData = await ytRes.json();
          nextPageToken = ytData.nextPageToken;
          const videoIds = (ytData.items || [])
            .map((item: any) => item.id?.videoId)
            .filter(Boolean)
            .join(',');

          if (videoIds) {
            const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,statistics&id=${videoIds}&key=${apiKey}`;
            const detailsRes = await fetch(detailsUrl);
            if (detailsRes.ok) {
              const detailsData = await detailsRes.json();
              items = (detailsData.items || []).map((v: any) => {
                const parsedDuration = parseIsoDuration(v.contentDetails?.duration);
                return {
                  videoId: v.id,
                  title: cleanTitle(v.snippet?.title || ''),
                  artist: cleanArtistName(v.snippet?.channelTitle, v.snippet?.title),
                  album: 'YouTube Music',
                  duration: parsedDuration.formatted,
                  durationSec: parsedDuration.seconds,
                  thumbnail:
                    v.snippet?.thumbnails?.high?.url ||
                    v.snippet?.thumbnails?.medium?.url ||
                    `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
                  views: formatViews(parseInt(v.statistics?.viewCount || '0', 10)),
                  publishedAt: v.snippet?.publishedAt
                };
              });
            }
          }
        }
      } catch (apiErr) {
        console.warn('[YouTubeSearch] Official Data API error, using yt-search fallback:', apiErr);
      }
    }

    // 2. High-speed yt-search fallback (100% reliability, no quota limits)
    if (items.length === 0) {
      const searchResult = await ytSearch({ query: `${query} song` });
      const rawVideos = searchResult.videos || [];

      // Filter to relevant music tracks (exclude > 20 min mixes unless specifically searched, exclude 0s)
      const isMixQuery = query.toLowerCase().includes('mix') || query.toLowerCase().includes('jukebox') || query.toLowerCase().includes('compilation');
      const filtered = rawVideos.filter((v) => {
        if (!v.videoId || !v.title) return false;
        if (!isMixQuery && v.seconds > 1200) return false; // filter out 20min+ long podcasts/streams
        return v.seconds >= 20; // filter out ultra short snippets
      });

      // Pagination slice
      const startIndex = (page - 1) * limit;
      const paginatedVideos = filtered.slice(startIndex, startIndex + limit);

      items = paginatedVideos.map((v) => {
        return {
          videoId: v.videoId,
          title: cleanTitle(v.title),
          artist: cleanArtistName(v.author?.name, v.title),
          album: 'YouTube Music',
          duration: v.timestamp || '3:30',
          durationSec: v.seconds || 210,
          thumbnail: v.thumbnail || v.image || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
          views: formatViews(v.views),
          ago: v.ago
        };
      });

      if (filtered.length > startIndex + limit) {
        nextPageToken = `page_${page + 1}`;
      }
    }

    // Map into standardized Track models
    const allTracks = items.map((item) => ({
      id: `yt-${item.videoId}`,
      videoId: item.videoId,
      title: item.title,
      artist: item.artist,
      album: item.album || 'YouTube Music',
      duration: item.duration,
      durationSec: item.durationSec,
      coverUrl: item.thumbnail,
      quality: 'YouTube Music (Official Player)',
      views: item.views,
      source: 'youtube' as const,
      isFavorite: false
    }));

    // Top Result calculation
    let topResult: any = null;
    if (allTracks.length > 0 && page === 1) {
      const first = allTracks[0];
      topResult = {
        type: 'song',
        item: first
      };
    }

    // Extract dynamic artist suggestions
    const artistNames = Array.from(new Set(allTracks.map((t) => t.artist))).slice(0, 4);
    const artists = artistNames.map((name, idx) => {
      const sampleTrack = allTracks.find((t) => t.artist === name);
      return {
        id: `yt-art-${idx}-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        name,
        avatarUrl: sampleTrack?.coverUrl || '/streamzy_logo.jpg',
        tracks: allTracks.filter((t) => t.artist === name),
        trackCount: allTracks.filter((t) => t.artist === name).length,
        albumCount: 1
      };
    });

    // Extract video items
    const videos = allTracks.map((t) => ({
      id: t.videoId,
      videoId: t.videoId,
      title: t.title,
      artist: t.artist,
      thumbnailUrl: t.coverUrl,
      views: t.views || 'YouTube Music',
      duration: t.duration
    }));

    const responsePayload = {
      status: 'ok',
      query,
      page,
      hasMore: Boolean(nextPageToken),
      nextPageToken,
      topResult,
      songs: allTracks,
      videos,
      artists,
      albums: [],
      totalCount: allTracks.length
    };

    // Store in TTL cache
    searchCache.set(cacheKey, {
      data: responsePayload,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    res.setHeader('X-Cache', 'MISS');
    res.json(responsePayload);
  } catch (err: any) {
    console.error('[YouTubeSearch] Search route error:', err);
    res.status(500).json({ error: 'YouTube Search Failed', details: err?.message });
  }
});
