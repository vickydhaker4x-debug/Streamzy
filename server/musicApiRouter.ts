import { Router, Request, Response } from 'express';
import { musicApiService, CACHE_TTL } from './musicApiService.ts';
import { redis } from './redisCacheService.ts';

export const musicApiRouter = Router();

/**
 * GET /api/search
 * Multi-layer indexed search with Redis TTL caching
 * Query params: ?q=query&limit=20
 */
musicApiRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const result = await musicApiService.search(query, limit);

    // Set HTTP Cache-Control header for client-side caching
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.SEARCH}`);
    res.json(result);
  } catch (err: any) {
    console.error('[musicApiRouter] Search error:', err);
    res.status(500).json({ error: 'Search operation failed', details: err?.message });
  }
});

/**
 * GET /api/songs
 * List all songs with optional genre filter
 */
musicApiRouter.get('/songs', async (req: Request, res: Response) => {
  try {
    const genre = req.query.genre as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const songs = await musicApiService.getAllSongs(genre, limit);
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.SONG}`);
    res.json({ status: 'ok', count: songs.length, songs });
  } catch (err: any) {
    console.error('[musicApiRouter] Get songs error:', err);
    res.status(500).json({ error: 'Failed to retrieve songs', details: err?.message });
  }
});

/**
 * GET /api/songs/:id
 * Retrieve rich song metadata with Redis TTL caching
 */
musicApiRouter.get('/songs/:id', async (req: Request, res: Response) => {
  try {
    const songId = req.params.id;
    const song = await musicApiService.getSongById(songId);

    if (!song) {
      return res.status(404).json({ error: `Song with ID "${songId}" not found in catalog` });
    }

    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.SONG}`);
    res.json({ status: 'ok', song });
  } catch (err: any) {
    console.error('[musicApiRouter] Get song by ID error:', err);
    res.status(500).json({ error: 'Failed to retrieve song metadata', details: err?.message });
  }
});

/**
 * GET /api/albums
 * List all albums
 */
musicApiRouter.get('/albums', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const albums = await musicApiService.getAllAlbums(limit);
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.ALBUM}`);
    res.json({ status: 'ok', count: albums.length, albums });
  } catch (err: any) {
    console.error('[musicApiRouter] Get albums error:', err);
    res.status(500).json({ error: 'Failed to retrieve albums', details: err?.message });
  }
});

/**
 * GET /api/albums/:id
 * Retrieve rich album metadata with tracklist and duration with Redis TTL caching
 */
musicApiRouter.get('/albums/:id', async (req: Request, res: Response) => {
  try {
    const albumId = req.params.id;
    const album = await musicApiService.getAlbumById(albumId);

    if (!album) {
      return res.status(404).json({ error: `Album with ID "${albumId}" not found` });
    }

    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.ALBUM}`);
    res.json({ status: 'ok', album });
  } catch (err: any) {
    console.error('[musicApiRouter] Get album by ID error:', err);
    res.status(500).json({ error: 'Failed to retrieve album metadata', details: err?.message });
  }
});

/**
 * GET /api/artists
 * List all indexed artists
 */
musicApiRouter.get('/artists', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const artists = await musicApiService.getAllArtists(limit);
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.ARTIST}`);
    res.json({ status: 'ok', count: artists.length, artists });
  } catch (err: any) {
    console.error('[musicApiRouter] Get artists error:', err);
    res.status(500).json({ error: 'Failed to retrieve artists', details: err?.message });
  }
});

/**
 * GET /api/artists/:id
 * Retrieve rich artist metadata, top tracks, and discography with Redis TTL caching
 */
musicApiRouter.get('/artists/:id', async (req: Request, res: Response) => {
  try {
    const artistId = req.params.id;
    const artist = await musicApiService.getArtistById(artistId);

    if (!artist) {
      return res.status(404).json({ error: `Artist with ID "${artistId}" not found` });
    }

    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.ARTIST}`);
    res.json({ status: 'ok', artist });
  } catch (err: any) {
    console.error('[musicApiRouter] Get artist by ID error:', err);
    res.status(500).json({ error: 'Failed to retrieve artist metadata', details: err?.message });
  }
});

/**
 * GET /api/recommendations
 * Algorithmic recommendations based on seed track, vibe, and time-of-day
 */
musicApiRouter.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const seedId = req.query.seedId as string | undefined;
    const vibe = req.query.vibe as string | undefined;
    const timeOfDay = req.query.timeOfDay as 'morning' | 'afternoon' | 'evening' | 'night' | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;

    const result = await musicApiService.getRecommendations(seedId, vibe, timeOfDay, limit);
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.RECOMMENDATIONS}`);
    res.json(result);
  } catch (err: any) {
    console.error('[musicApiRouter] Recommendations error:', err);
    res.status(500).json({ error: 'Failed to generate recommendations', details: err?.message });
  }
});

/**
 * GET /api/quick-picks
 * Centralized Quick Picks endpoint utilizing 3-pillar recency + frequency + context algorithm
 */
musicApiRouter.get('/quick-picks', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default_user';
    const timeOfDay = req.query.timeOfDay as 'morning' | 'afternoon' | 'evening' | 'night' | undefined;
    const clientHour = req.query.clientHour ? parseInt(req.query.clientHour as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 16;

    const result = await musicApiService.getQuickPicks(userId, timeOfDay, clientHour, limit);
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.QUICK_PICKS}`);
    res.json(result);
  } catch (err: any) {
    console.error('[musicApiRouter] Quick Picks error:', err);
    res.status(500).json({ error: 'Failed to retrieve quick picks', details: err?.message });
  }
});

/**
 * GET /api/queue
 * Retrieve user's active playback queue
 */
musicApiRouter.get('/queue', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default_user';
    const queue = await musicApiService.getQueue(userId);
    res.json({ status: 'ok', queue });
  } catch (err: any) {
    console.error('[musicApiRouter] Get queue error:', err);
    res.status(500).json({ error: 'Failed to retrieve queue', details: err?.message });
  }
});

/**
 * POST /api/queue
 * Update user's active playback queue & invalidate queue cache
 */
musicApiRouter.post('/queue', async (req: Request, res: Response) => {
  try {
    const { userId = 'default_user', deviceId, currentTrackId, currentTrack, queueTrackIds, queueTracks, isPlaying, progressSec } = req.body;
    const updated = await musicApiService.updateQueue(
      userId,
      { currentTrackId, currentTrack, queueTrackIds, queueTracks, isPlaying, progressSec },
      deviceId
    );
    res.json({ status: 'ok', queue: updated });
  } catch (err: any) {
    console.error('[musicApiRouter] Update queue error:', err);
    res.status(500).json({ error: 'Failed to update queue', details: err?.message });
  }
});

/**
 * GET /api/history
 * Retrieve user's listening playback history
 */
musicApiRouter.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default_user';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const historyData = await musicApiService.getHistory(userId, limit);
    res.json({ status: 'ok', ...historyData });
  } catch (err: any) {
    console.error('[musicApiRouter] Get history error:', err);
    res.status(500).json({ error: 'Failed to retrieve history', details: err?.message });
  }
});

/**
 * POST /api/history
 * Record track play to history & invalidate user caches
 */
musicApiRouter.post('/history', async (req: Request, res: Response) => {
  try {
    const { userId = 'default_user', trackId, loopCount = 1, durationSec = 200, timeOfDay, deviceId } = req.body;
    const updated = await musicApiService.recordHistory(userId, {
      trackId,
      loopCount,
      durationSec,
      timeOfDay,
      deviceId
    });
    res.json({ status: 'ok', message: 'Playback recorded to history', eventCount: updated.playbackEvents.length });
  } catch (err: any) {
    console.error('[musicApiRouter] Post history error:', err);
    res.status(500).json({ error: 'Failed to record history', details: err?.message });
  }
});

/**
 * DELETE /api/history
 * Clear playback history
 */
musicApiRouter.delete('/history', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'default_user';
    const result = await musicApiService.clearHistory(userId);
    res.json(result);
  } catch (err: any) {
    console.error('[musicApiRouter] Clear history error:', err);
    res.status(500).json({ error: 'Failed to clear history', details: err?.message });
  }
});

/**
 * POST /api/cache/invalidate
 * Targeted or global cache invalidation
 */
musicApiRouter.post('/cache/invalidate', async (req: Request, res: Response) => {
  try {
    const { target = 'all', userId, key } = req.body;

    if (key) {
      await redis.del(key);
      return res.json({ status: 'ok', message: `Key "${key}" invalidated` });
    }

    if (target === 'search') {
      const result = await musicApiService.invalidateSearchCaches();
      return res.json(result);
    }

    if (target === 'user' && userId) {
      await musicApiService.invalidateUserCaches(userId);
      return res.json({ status: 'ok', message: `Caches for user "${userId}" invalidated` });
    }

    const result = await musicApiService.invalidateAllCaches();
    return res.json(result);
  } catch (err: any) {
    console.error('[musicApiRouter] Cache invalidation error:', err);
    res.status(500).json({ error: 'Failed to invalidate cache', details: err?.message });
  }
});

/**
 * GET /api/cache/stats
 * Telemetry and statistics of Redis/In-Memory Cache (hits, misses, hit rate, TTLs)
 */
musicApiRouter.get('/cache/stats', (req: Request, res: Response) => {
  const info = redis.getInfo();
  res.json({
    ...info,
    ttls: CACHE_TTL,
    policy: 'TTL-based with LRU eviction and periodic expiration sweeps'
  });
});
