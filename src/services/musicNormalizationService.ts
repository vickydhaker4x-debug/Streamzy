import { Track, Album, Artist } from '../types';

/**
 * Slugify text into clean URL-safe and ID-safe identifier
 */
export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Format raw seconds into mm:ss
 */
export function formatDurationSec(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '3:30';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Parse duration string (e.g. "3:45", "04:20", "1:15:30") into integer seconds
 */
export function parseDurationToSec(durationStr: string | number): number {
  if (typeof durationStr === 'number') return Math.max(0, Math.floor(durationStr));
  if (!durationStr || typeof durationStr !== 'string') return 210;

  const parts = durationStr.split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 210;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 210;
}

/**
 * Parse human readable play count strings (e.g. "45 lakh plays", "540M plays", "820K") into number
 */
export function parsePlayCount(playsText?: string | number): number {
  if (typeof playsText === 'number') return playsText;
  if (!playsText) return 10000;

  const text = playsText.toLowerCase().replace(/,/g, '');
  const numMatch = text.match(/[\d.]+/);
  if (!numMatch) return 10000;
  const val = parseFloat(numMatch[0]);

  if (text.includes('crore') || text.includes('cr')) return Math.round(val * 10000000);
  if (text.includes('lakh') || text.includes('lac')) return Math.round(val * 100000);
  if (text.includes('b')) return Math.round(val * 1000000000);
  if (text.includes('m')) return Math.round(val * 1000000);
  if (text.includes('k')) return Math.round(val * 1000);

  return Math.round(val);
}

/**
 * Auto-detect primary language from artist, title and genre text
 */
export function detectLanguage(title = '', artist = '', genre = ''): string {
  const combined = `${title} ${artist} ${genre}`.toLowerCase();

  if (/punjabi|sidhu|dhillon|dosanjh|moosewala|aujla|shubh|amrit|jatt|desihood/i.test(combined)) {
    return 'Punjabi';
  }
  if (
    /hindi|arijit|pritam|shreya|jubin|atif|sonu|armaan|bhattacharya|kesariya|tum hi|bhediya|jawan|animal|brahmastra|chaleya|dhadak|t-series|bollywood/i.test(
      combined
    )
  ) {
    return 'Hindi';
  }
  if (/tamil|anirudh|ar rahman|ilayaraja|sid sriram|yuvan/i.test(combined)) {
    return 'Tamil';
  }
  if (/telugu|dsp|thaman|keeravani/i.test(combined)) {
    return 'Telugu';
  }
  if (/kpop|bts|blackpink|stray kids/i.test(combined)) {
    return 'K-Pop';
  }
  if (/spanish|bad bunny|rosalia|reggaeton|latin/i.test(combined)) {
    return 'Spanish';
  }
  return 'English';
}

/**
 * Clean text for robust matching & indexing
 */
export function cleanSearchToken(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate comprehensive searchable text token index
 */
export function generateSearchableText(track: Partial<Track>): string {
  const parts = [
    track.title || '',
    track.artist || '',
    track.album || '',
    track.genre || '',
    track.language || '',
    track.releaseYear || track.year || '',
    track.videoId || ''
  ];

  // Include lyrics snippets if available
  if (track.lyrics && Array.isArray(track.lyrics)) {
    const lyricSnippet = track.lyrics
      .map((l) => l.text)
      .filter((t) => !t.startsWith('♪'))
      .slice(0, 8)
      .join(' ');
    parts.push(lyricSnippet);
  }

  return cleanSearchToken(parts.join(' '));
}

/**
 * Known canonical mappings between video IDs and standard track IDs to ensure
 * consistency across local storage, playback history, and remote API searches.
 */
const CANONICAL_ID_MAP: Record<string, string> = {
  'Hc-rc1-hcco': 'track-sauda-iss-dil-ka',
  'vIQAt0eIu2k': 'track-lofi-lovee',
  'l8Z3azp_qK8': 'track-preet-re',
  'J_CD7rFH-O0': 'track-kinna-sohna',
  'BddP6PYo2gs': 'track-kesariya',
  'ElZfdU54Cp8': 'track-apna-bana-le',
  'IJq0yyWug1k': 'track-tum-hi-ho',
  'VAdGW7QDJiU': 'track-chaleya',
  'gvyUuxdRdR4': 'track-raataan',
  '9-LH8ABADdo': 'track-shayad',
  'sK7riqg2mr4': 'track-agar-tum',
  'n_FCrCQ6-9U': 'track-295',
  'VNs_cCtdbPc': 'track-brown-munde',
  '4NRXx6U8ABQ': 'track-blinding-lights',
  '34Na4j8AVgA': 'track-starboy',
  '60ItHLz5WEA': 'track-faded'
};

/**
 * Extract canonical primary artist name
 */
export function extractPrimaryArtist(artistText: string): string {
  if (!artistText) return 'Unknown Artist';
  return artistText.split(/[,&/|]/)[0].trim() || artistText;
}

/**
 * Generate canonical track ID from videoId, title and artist
 */
export function getCanonicalTrackId(raw: { id?: string; videoId?: string; title?: string; artist?: string }): string {
  if (raw.videoId && CANONICAL_ID_MAP[raw.videoId]) {
    return CANONICAL_ID_MAP[raw.videoId];
  }

  if (raw.videoId && raw.videoId.length >= 8) {
    return `track-yt-${raw.videoId}`;
  }

  if (raw.id && (raw.id.startsWith('track-') || raw.id.startsWith('fav-') || raw.id.startsWith('cust-'))) {
    return raw.id;
  }

  const slugTitle = slugify(raw.title || 'untitled');
  const slugArtist = slugify(raw.artist || 'unknown');
  return `track-${slugTitle}-${slugArtist}`.slice(0, 60);
}

/**
 * Generate a unique comparison key for song deduplication.
 * Two songs with the same underlying source / videoId or exact title+artist match
 * will yield the exact same deduplication key.
 */
export function getSongDeduplicationKey(track: Partial<Track>): string {
  const title = (track.title || '').replace(/\(.*\)|\[.*\]/g, '').trim();
  const cleanTitle = cleanSearchToken(title);
  const cleanArtist = cleanSearchToken(extractPrimaryArtist(track.artist || ''));
  
  if (cleanTitle && cleanArtist) {
    return `meta:${cleanTitle}:::${cleanArtist}`;
  }

  if (track.videoId && track.videoId.trim().length >= 8) {
    return `yt:${track.videoId.trim()}`;
  }

  if (track.audioUrl && !track.audioUrl.startsWith('blob:')) {
    return `url:${track.audioUrl.trim()}`;
  }

  return `meta:${cleanTitle}:::${cleanArtist}`;
}

/**
 * Central normalization function.
 * Ensures EVERY track in the app conforms to the single normalized music data model.
 */
export function normalizeTrack(raw: Partial<Track>): Track {
  const durationSec = raw.durationSec
    ? Math.max(10, Math.floor(raw.durationSec))
    : parseDurationToSec(raw.duration || '3:30');

  const duration = raw.duration || formatDurationSec(durationSec);

  const rawCover = raw.albumArt || raw.coverUrl || '';
  const coverUrl = rawCover.startsWith('http')
    ? rawCover
    : raw.videoId
    ? `https://i.ytimg.com/vi/${raw.videoId}/mqdefault.jpg`
    : '/streamzy_logo.jpg';

  const albumArt = coverUrl;

  const canonicalId = getCanonicalTrackId({
    id: raw.id,
    videoId: raw.videoId,
    title: raw.title,
    artist: raw.artist
  });

  const title = (raw.title || 'Untitled Song').trim();
  const artist = (raw.artist || 'Unknown Artist').trim();
  const primaryArtist = extractPrimaryArtist(artist);
  const artistId = raw.artistId || `art-${slugify(primaryArtist)}`;

  const album = (raw.album || title).trim();
  const albumId = raw.albumId || `alb-${slugify(album)}`;

  const year = raw.releaseYear || raw.year || '2024';
  const releaseYear = year;

  const language = raw.language || detectLanguage(title, artist, raw.genre || '');
  const genre = raw.genre || (language === 'Punjabi' ? 'Punjabi Urban' : language === 'Hindi' ? 'Bollywood Melodic' : 'Pop');

  const playCount = typeof raw.playCount === 'number' ? raw.playCount : parsePlayCount(raw.plays);
  const popularity = typeof raw.popularity === 'number'
    ? raw.popularity
    : Math.min(100, Math.max(10, Math.round(Math.log10(Math.max(100, playCount)) * 12)));

  const likes = typeof raw.likes === 'number' ? raw.likes : Math.round(playCount * 0.04);

  // Extract collaborators for related artists
  const collabs = artist
    .split(/[,&/|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.toLowerCase() !== primaryArtist.toLowerCase());

  const relatedArtists = raw.relatedArtists && raw.relatedArtists.length > 0
    ? raw.relatedArtists
    : collabs.length > 0
    ? collabs
    : [primaryArtist];

  const source = raw.source || (raw.audioUrl ? 'local' : 'youtube');

  const normalized: Track = {
    id: canonicalId,
    title,
    artist,
    artistId,
    album,
    albumId,
    albumArt,
    coverUrl,
    duration,
    durationSec,
    audioUrl: raw.audioUrl || raw.streamUrl,
    streamUrl: raw.streamUrl || raw.audioUrl,
    source,
    genre,
    language,
    releaseYear,
    year,
    explicit: Boolean(raw.explicit),
    popularity,
    playCount,
    likes,
    searchableText: raw.searchableText || generateSearchableText({ title, artist, album, genre, language, releaseYear, videoId: raw.videoId, lyrics: raw.lyrics }),
    relatedArtists,
    relatedSongs: raw.relatedSongs || [],
    relatedAlbums: raw.relatedAlbums || [album],
    isFavorite: Boolean(raw.isFavorite),
    quality: raw.quality || '320kbps High Quality',
    lyrics: raw.lyrics || undefined,
    videoId: raw.videoId,
    plays: raw.plays || `${(playCount / 100000).toFixed(1)} lakh plays`,
    isDownloaded: Boolean(raw.isDownloaded),
    isSmartDownloaded: Boolean(raw.isSmartDownloaded),
    playedAt: raw.playedAt
  };

  return normalized;
}

/**
 * Deduplicate an array of tracks.
 * Two songs with the same underlying source/video/song ID will NOT appear as separate songs.
 * Merges richer metadata (lyrics, covers, play counts, favorite status).
 */
export function deduplicateTracks(tracks: (Partial<Track> | Track)[]): Track[] {
  if (!tracks || !Array.isArray(tracks)) return [];

  const keyMap = new Map<string, Track>();
  const idMap = new Map<string, Track>();

  for (const item of tracks) {
    if (!item) continue;
    const normalized = normalizeTrack(item);
    const dedupKey = getSongDeduplicationKey(normalized);
    const existing = keyMap.get(dedupKey) || idMap.get(normalized.id);

    if (!existing) {
      keyMap.set(dedupKey, normalized);
      idMap.set(normalized.id, normalized);
    } else {
      // Merge best fields from both representations
      const merged: Track = {
        ...existing,
        // If the new one has lyrics and existing doesn't, keep lyrics
        lyrics: existing.lyrics && existing.lyrics.length > 0 ? existing.lyrics : normalized.lyrics,
        // Keep videoId if available
        videoId: existing.videoId || normalized.videoId,
        // Keep audioUrl if available
        audioUrl: existing.audioUrl || normalized.audioUrl,
        streamUrl: existing.streamUrl || normalized.streamUrl,
        // If user marked one as favorite, keep favorite true
        isFavorite: existing.isFavorite || normalized.isFavorite,
        // Keep downloaded status
        isDownloaded: existing.isDownloaded || normalized.isDownloaded,
        isSmartDownloaded: existing.isSmartDownloaded || normalized.isSmartDownloaded,
        // Max play count
        playCount: Math.max(existing.playCount || 0, normalized.playCount || 0),
        // Max likes
        likes: Math.max(existing.likes || 0, normalized.likes || 0),
        // Highest quality cover
        coverUrl: (existing.coverUrl && !existing.coverUrl.includes('logo')) ? existing.coverUrl : normalized.coverUrl,
        albumArt: (existing.albumArt && !existing.albumArt.includes('logo')) ? existing.albumArt : normalized.albumArt,
        // Update playedAt to newest
        playedAt: Math.max(existing.playedAt || 0, normalized.playedAt || 0) || undefined
      };

      keyMap.set(dedupKey, merged);
      idMap.set(merged.id, merged);
    }
  }

  return Array.from(keyMap.values());
}

/**
 * Check if two tracks refer to the exact same song
 */
export function areTracksEqual(a?: Partial<Track> | null, b?: Partial<Track> | null): boolean {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  if (a.videoId && b.videoId && a.videoId === b.videoId) return true;
  return getSongDeduplicationKey(a) === getSongDeduplicationKey(b);
}

/**
 * Strip temporary/resolved playback URLs before saving to local storage or DB.
 * Persists everything else (metadata, favorite status, title, artist, etc).
 */
export function sanitizeTrackForPersistence(track: Track): Track {
  if (!track) return track;
  const sanitized = { ...track };
  delete sanitized.audioUrl;
  delete sanitized.streamUrl;
  return sanitized;
}

