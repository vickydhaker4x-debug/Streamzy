import { redis } from './redisCacheService.ts';
import { SERVER_TRACKS_CATALOG, CatalogTrack, quickPicksService } from './quickPicksService.ts';
import { accountDatabase } from './accountDatabase.ts';

export interface AlbumMetadata {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  year?: string;
  genre?: string;
  tracks: CatalogTrack[];
  totalDurationSec: number;
}

export interface ArtistMetadata {
  id: string;
  name: string;
  avatarUrl: string;
  genres: string[];
  bio?: string;
  topTracks: CatalogTrack[];
  albums: { id: string; title: string; coverUrl: string; year?: string; trackCount: number }[];
  totalPlaysFormatted?: string;
}

export interface SearchResultsPayload {
  query: string;
  correctedQuery?: string;
  hasTypoCorrection: boolean;
  topResult?: {
    type: 'song' | 'artist' | 'album';
    item: CatalogTrack | ArtistMetadata | AlbumMetadata;
  };
  songs: CatalogTrack[];
  albums: AlbumMetadata[];
  artists: ArtistMetadata[];
  cached?: boolean;
}

// TTL Cache configurations (in seconds)
export const CACHE_TTL = {
  SEARCH: 180,         // 3 minutes
  SONG: 3600,          // 1 hour
  ALBUM: 3600,         // 1 hour
  ARTIST: 3600,        // 1 hour
  RECOMMENDATIONS: 120,// 2 minutes
  QUICK_PICKS: 180,    // 3 minutes
  QUEUE: 30,           // 30 seconds
  HISTORY: 60          // 1 minute
};

class MusicApiService {
  private catalog: CatalogTrack[] = SERVER_TRACKS_CATALOG;
  private albumIndex: Map<string, AlbumMetadata> = new Map();
  private artistIndex: Map<string, ArtistMetadata> = new Map();

  constructor() {
    this.indexCatalog();
  }

  /**
   * Builds normalized Album and Artist indexes from the catalog
   */
  private indexCatalog() {
    const albumMap = new Map<string, CatalogTrack[]>();
    const artistMap = new Map<string, CatalogTrack[]>();

    for (const track of this.catalog) {
      // Album grouping
      const albumKey = track.album || 'Single';
      if (!albumMap.has(albumKey)) {
        albumMap.set(albumKey, []);
      }
      albumMap.get(albumKey)!.push(track);

      // Artist grouping (split co-artists if applicable)
      const primaryArtist = track.artist.split(/[,&]/)[0].trim();
      if (!artistMap.has(primaryArtist)) {
        artistMap.set(primaryArtist, []);
      }
      artistMap.get(primaryArtist)!.push(track);
    }

    // Build AlbumMetadata
    albumMap.forEach((tracks, albumTitle) => {
      const first = tracks[0];
      const albumId = `alb-${albumTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const totalDurationSec = tracks.reduce((sum, t) => sum + (t.durationSec || 0), 0);

      this.albumIndex.set(albumId, {
        id: albumId,
        title: albumTitle,
        artist: first.artist,
        coverUrl: first.coverUrl,
        year: first.year || '2024',
        genre: first.genre || 'Soundtrack',
        tracks,
        totalDurationSec
      });
    });

    // Build ArtistMetadata
    artistMap.forEach((tracks, artistName) => {
      const first = tracks[0];
      const artistId = `art-${artistName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const genres = Array.from(new Set(tracks.map((t) => t.genre).filter(Boolean) as string[]));

      const albumsForArtist = Array.from(this.albumIndex.values())
        .filter((alb) => alb.artist.toLowerCase().includes(artistName.toLowerCase()))
        .map((alb) => ({
          id: alb.id,
          title: alb.title,
          coverUrl: alb.coverUrl,
          year: alb.year,
          trackCount: alb.tracks.length
        }));

      this.artistIndex.set(artistId, {
        id: artistId,
        name: artistName,
        avatarUrl: first.coverUrl,
        genres: genres.length > 0 ? genres : ['Bollywood', 'Pop'],
        bio: `${artistName} is a celebrated artist featured prominently with top hits in Bollywood, Indian Pop, and contemporary music.`,
        topTracks: tracks.slice(0, 10),
        albums: albumsForArtist,
        totalPlaysFormatted: '450M+ plays'
      });
    });
  }

  /**
   * Search songs, albums, and artists with Redis TTL caching
   */
  public async search(rawQuery: string, limit = 20): Promise<SearchResultsPayload> {
    const q = (rawQuery || '').trim().toLowerCase();
    if (!q) {
      return {
        query: rawQuery,
        hasTypoCorrection: false,
        songs: [],
        albums: [],
        artists: [],
        cached: false
      };
    }

    const cacheKey = `cache:search:${q}:${limit}`;
    const cached = await redis.get<SearchResultsPayload>(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    // Perform fresh server search
    const cleanQ = q.replace(/[^a-z0-9\s]/g, '');
    const tokens = cleanQ.split(/\s+/).filter(Boolean);

    // Score songs
    const matchedSongs = this.catalog.filter((t) => {
      const fullText = `${t.title} ${t.artist} ${t.album || ''} ${t.genre || ''}`.toLowerCase();
      if (fullText.includes(cleanQ)) return true;
      return tokens.some((token) => fullText.includes(token));
    }).slice(0, limit);

    // Score albums
    const matchedAlbums = Array.from(this.albumIndex.values()).filter((alb) => {
      const fullText = `${alb.title} ${alb.artist}`.toLowerCase();
      return fullText.includes(cleanQ) || tokens.some((token) => fullText.includes(token));
    }).slice(0, 8);

    // Score artists
    const matchedArtists = Array.from(this.artistIndex.values()).filter((art) => {
      const fullText = `${art.name} ${(art.genres || []).join(' ')}`.toLowerCase();
      return fullText.includes(cleanQ) || tokens.some((token) => fullText.includes(token));
    }).slice(0, 6);

    let topResult: SearchResultsPayload['topResult'] = undefined;
    if (matchedArtists.length > 0 && matchedArtists[0].name.toLowerCase().includes(cleanQ)) {
      topResult = { type: 'artist', item: matchedArtists[0] };
    } else if (matchedSongs.length > 0) {
      topResult = { type: 'song', item: matchedSongs[0] };
    } else if (matchedAlbums.length > 0) {
      topResult = { type: 'album', item: matchedAlbums[0] };
    }

    const result: SearchResultsPayload = {
      query: rawQuery,
      hasTypoCorrection: false,
      topResult,
      songs: matchedSongs,
      albums: matchedAlbums,
      artists: matchedArtists,
      cached: false
    };

    // Store in Redis with TTL
    await redis.set(cacheKey, result, CACHE_TTL.SEARCH);
    return result;
  }

  /**
   * Get song metadata by ID with Redis TTL caching
   */
  public async getSongById(id: string): Promise<CatalogTrack | null> {
    const cacheKey = `cache:song:${id}`;
    const cached = await redis.get<CatalogTrack>(cacheKey);
    if (cached) return cached;

    const track = this.catalog.find((t) => t.id === id || t.videoId === id);
    if (!track) return null;

    await redis.set(cacheKey, track, CACHE_TTL.SONG);
    return track;
  }

  /**
   * Get all songs (catalog)
   */
  public async getAllSongs(genre?: string, limit = 50): Promise<CatalogTrack[]> {
    const cacheKey = `cache:songs:all:${genre || 'all'}:${limit}`;
    const cached = await redis.get<CatalogTrack[]>(cacheKey);
    if (cached) return cached;

    let tracks = this.catalog;
    if (genre && genre !== 'all') {
      tracks = tracks.filter((t) => (t.genre || '').toLowerCase() === genre.toLowerCase());
    }
    const result = tracks.slice(0, limit);
    await redis.set(cacheKey, result, CACHE_TTL.SONG);
    return result;
  }

  /**
   * Get album metadata by ID with Redis TTL caching
   */
  public async getAlbumById(id: string): Promise<AlbumMetadata | null> {
    const cacheKey = `cache:album:${id}`;
    const cached = await redis.get<AlbumMetadata>(cacheKey);
    if (cached) return cached;

    let album = this.albumIndex.get(id);
    if (!album) {
      // Lookup by title fuzzy
      album = Array.from(this.albumIndex.values()).find(
        (a) => a.id.toLowerCase() === id.toLowerCase() || a.title.toLowerCase() === id.toLowerCase()
      );
    }

    if (!album) return null;
    await redis.set(cacheKey, album, CACHE_TTL.ALBUM);
    return album;
  }

  /**
   * Get all albums
   */
  public async getAllAlbums(limit = 20): Promise<AlbumMetadata[]> {
    const cacheKey = `cache:albums:all:${limit}`;
    const cached = await redis.get<AlbumMetadata[]>(cacheKey);
    if (cached) return cached;

    const albums = Array.from(this.albumIndex.values()).slice(0, limit);
    await redis.set(cacheKey, albums, CACHE_TTL.ALBUM);
    return albums;
  }

  /**
   * Get artist metadata by ID with Redis TTL caching
   */
  public async getArtistById(id: string): Promise<ArtistMetadata | null> {
    const cacheKey = `cache:artist:${id}`;
    const cached = await redis.get<ArtistMetadata>(cacheKey);
    if (cached) return cached;

    let artist = this.artistIndex.get(id);
    if (!artist) {
      // Lookup by name fuzzy
      artist = Array.from(this.artistIndex.values()).find(
        (a) => a.id.toLowerCase() === id.toLowerCase() || a.name.toLowerCase() === id.toLowerCase()
      );
    }

    if (!artist) return null;
    await redis.set(cacheKey, artist, CACHE_TTL.ARTIST);
    return artist;
  }

  /**
   * Get all artists
   */
  public async getAllArtists(limit = 20): Promise<ArtistMetadata[]> {
    const cacheKey = `cache:artists:all:${limit}`;
    const cached = await redis.get<ArtistMetadata[]>(cacheKey);
    if (cached) return cached;

    const artists = Array.from(this.artistIndex.values()).slice(0, limit);
    await redis.set(cacheKey, artists, CACHE_TTL.ARTIST);
    return artists;
  }

  /**
   * Get algorithmic recommendations based on seed track, vibe, and time of day with TTL caching
   */
  public async getRecommendations(
    seedId?: string,
    vibe?: string,
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night',
    limit = 15
  ): Promise<{ seedTrack?: CatalogTrack; vibe: string; timeOfDay?: string; recommendations: CatalogTrack[]; cached?: boolean }> {
    const safeSeed = seedId || 'default';
    const safeVibe = vibe || 'trending';
    const safeTime = timeOfDay || 'all';
    const cacheKey = `cache:recs:${safeSeed}:${safeVibe}:${safeTime}:${limit}`;

    const cached = await redis.get<any>(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    let seedTrack: CatalogTrack | undefined;
    if (seedId) {
      seedTrack = this.catalog.find((t) => t.id === seedId || t.videoId === seedId);
    }

    let recs = [...this.catalog];

    // Filter or prioritize based on seed track genre/artist
    if (seedTrack) {
      recs = recs.filter((t) => t.id !== seedTrack?.id);
      recs.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;
        if (a.artist === seedTrack?.artist) scoreA += 50;
        if (b.artist === seedTrack?.artist) scoreB += 50;
        if (a.genre === seedTrack?.genre) scoreA += 30;
        if (b.genre === seedTrack?.genre) scoreB += 30;
        return scoreB - scoreA;
      });
    } else if (vibe && vibe !== 'trending') {
      recs.sort((a, b) => {
        const matchA = (a.genre || '').toLowerCase().includes(vibe.toLowerCase()) ? 1 : 0;
        const matchB = (b.genre || '').toLowerCase().includes(vibe.toLowerCase()) ? 1 : 0;
        return matchB - matchA;
      });
    }

    const finalRecommendations = recs.slice(0, limit);
    const response = {
      seedTrack,
      vibe: safeVibe,
      timeOfDay: safeTime,
      recommendations: finalRecommendations,
      cached: false
    };

    await redis.set(cacheKey, response, CACHE_TTL.RECOMMENDATIONS);
    return response;
  }

  /**
   * Get user Quick Picks (integrating with 3-pillar algorithm and Redis cache)
   */
  public async getQuickPicks(userId = 'default_user', timeOfDay?: any, clientHour?: number, limit = 16) {
    const cacheKey = `cache:quickpicks:${userId}:${timeOfDay || 'auto'}:${clientHour || 'auto'}:${limit}`;
    const cached = await redis.get<any>(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const result = quickPicksService.generateQuickPicks(userId, timeOfDay, clientHour, limit);
    await redis.set(cacheKey, result, CACHE_TTL.QUICK_PICKS);
    return { ...result, cached: false };
  }

  /**
   * Get current Queue for user session
   */
  public async getQueue(userId = 'default_user') {
    const cacheKey = `cache:queue:${userId}`;
    const cached = await redis.get<any>(cacheKey);
    if (cached) return cached;

    const account = accountDatabase.getAccount(userId);
    const currentTrack = account.upNextQueue.currentTrackId
      ? this.catalog.find((t) => t.id === account.upNextQueue.currentTrackId) || account.upNextQueue.currentTrack
      : null;

    const queueTracks = (account.upNextQueue.queueTrackIds || []).map((id) => {
      return this.catalog.find((t) => t.id === id) || { id, title: 'Queue Item', artist: 'Unknown' };
    });

    const queueData = {
      userId,
      currentTrackId: account.upNextQueue.currentTrackId,
      currentTrack,
      queueTrackIds: account.upNextQueue.queueTrackIds,
      queueTracks,
      isPlaying: account.upNextQueue.isPlaying,
      progressSec: account.upNextQueue.progressSec,
      updatedAt: account.upNextQueue.updatedAt
    };

    await redis.set(cacheKey, queueData, CACHE_TTL.QUEUE);
    return queueData;
  }

  /**
   * Update Queue for user session and invalidate cache
   */
  public async updateQueue(userId = 'default_user', queuePayload: any, deviceId?: string) {
    const updated = accountDatabase.updateQueue(userId, queuePayload, deviceId);
    // Invalidate queue cache
    await redis.del(`cache:queue:${userId}`);
    return updated.upNextQueue;
  }

  /**
   * Get User History
   */
  public async getHistory(userId = 'default_user', limit = 50) {
    const cacheKey = `cache:history:${userId}:${limit}`;
    const cached = await redis.get<any>(cacheKey);
    if (cached) return cached;

    const account = accountDatabase.getAccount(userId);
    const events = (account.playbackEvents || []).slice(-limit).reverse();

    const enrichedHistory = events.map((ev) => {
      const track = this.catalog.find((t) => t.id === ev.trackId);
      return {
        ...ev,
        track: track || { id: ev.trackId, title: 'Unknown Track', artist: 'Unknown' }
      };
    });

    const historyData = {
      userId,
      totalEvents: account.playbackEvents.length,
      history: enrichedHistory
    };

    await redis.set(cacheKey, historyData, CACHE_TTL.HISTORY);
    return historyData;
  }

  /**
   * Record history event and invalidate relevant caches
   */
  public async recordHistory(userId = 'default_user', payload: any) {
    const updated = accountDatabase.recordPlayback(userId, payload);
    // Invalidate history & quick picks caches for this user
    await this.invalidateUserCaches(userId);
    return updated;
  }

  /**
   * Clear History
   */
  public async clearHistory(userId = 'default_user') {
    accountDatabase.updateAccount(userId, (acc) => {
      acc.playbackEvents = [];
    });
    await this.invalidateUserCaches(userId);
    return { status: 'ok', message: 'History cleared' };
  }

  /**
   * Invalidate caches
   */
  public async invalidateUserCaches(userId: string) {
    const keys = await redis.keys(`cache:*:${userId}*`);
    for (const key of keys) {
      await redis.del(key);
    }
  }

  public async invalidateSearchCaches() {
    const keys = await redis.keys('cache:search:*');
    for (const key of keys) {
      await redis.del(key);
    }
    return { status: 'ok', invalidatedCount: keys.length };
  }

  public async invalidateAllCaches() {
    await redis.flushdb();
    return { status: 'ok', message: 'All music caches flushed' };
  }
}

export const musicApiService = new MusicApiService();
