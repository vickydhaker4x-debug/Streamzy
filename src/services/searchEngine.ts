import {
  Track,
  Album,
  Artist,
  Playlist,
  MusicMix,
  ContextualSearchResults,
  EnrichedTrackSearchResult,
  NormalizedSearchResult,
  SearchMatchType,
  LyricMatchDetail
} from '../types';
import { TRACKS } from '../data/musicData';
import { YTM_PERSONALIZED_MIXES } from '../data/ytmModulesData';
import { extractAlbums, extractArtists } from './libraryDataService';
import { lyricsService } from './lyricsService';
import { deduplicateTracks } from './musicNormalizationService';

function getUserPlaylists(): Playlist[] {
  try {
    const saved = localStorage.getItem('vd_user_playlists');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function getPlaybackHistoryIds(): Set<string> {
  const ids = new Set<string>();
  try {
    const saved = localStorage.getItem('vd_playback_history_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach((t: Track) => {
          if (t && t.id) ids.add(t.id);
        });
      }
    }
  } catch {}
  return ids;
}

function getLikedTrackIds(): Set<string> {
  const ids = new Set<string>();
  try {
    const saved = localStorage.getItem('vd_favorite_track_ids');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach((id: string) => ids.add(id));
      }
    }
  } catch {}
  return ids;
}

/**
 * Robust query & metadata normalization.
 * Handles:
 * - lowercase / uppercase
 * - extra and multiple spaces
 * - punctuation, symbols, brackets
 * - curly / straight apostrophes & quotes
 * - hyphens, underscores, slashes
 * - Unicode normalization (NFKD + diacritic removal)
 */
export function normalizeSearchQuery(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B']/g, '') // remove apostrophes so "don't" -> "dont"
    .replace(/[\u201C\u201D\u201E\u201F"]/g, '') // remove quotes
    .replace(/[-_/]/g, ' ') // treat hyphens, underscores, slashes as word boundaries
    .replace(/[^a-z0-9\s]/g, ' ') // convert all remaining punctuation to spaces
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

// Backwards compatibility alias
export const cleanSearchToken = normalizeSearchQuery;

/**
 * Phonetic Transliteration key for Indic/English phonetic variants
 */
function toPhoneticKey(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/aa|ee|oo/g, (m) => (m === 'aa' ? 'a' : m === 'ee' ? 'i' : 'u'))
    .replace(/ph/g, 'f')
    .replace(/sh/g, 's')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/dh/g, 'd')
    .replace(/th/g, 't')
    .replace(/jh/g, 'j')
    .replace(/bh/g, 'b')
    .replace(/w/g, 'v')
    .replace(/y/g, 'i')
    .replace(/([a-z])\1+/g, '$1')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if target string contains all significant words from query
 */
function matchesAllWords(target: string, query: string): boolean {
  const qWords = query.split(' ').filter((w) => w.length >= 2);
  if (qWords.length < 2) return false;
  return qWords.every((word) => target.includes(word));
}

/**
 * Common musical typo dictionary for real user misspellings
 */
const KNOWN_TYPO_CORRECTIONS: Record<string, string> = {
  arjit: 'Arijit Singh',
  arijeet: 'Arijit Singh',
  'arjit singh': 'Arijit Singh',
  arijitsingh: 'Arijit Singh',
  weaknd: 'The Weeknd',
  weekend: 'The Weeknd',
  'the weekend': 'The Weeknd',
  punjbi: 'Punjabi',
  panjabi: 'Punjabi',
  kesriya: 'Kesariya',
  kesariyaa: 'Kesariya',
  kesri: 'Kesariya',
  apdhillon: 'AP Dhillon',
  'ap dhilon': 'AP Dhillon',
  moosetape: 'Sidhu Moosewala',
  alanwalkr: 'Alan Walker',
  challeya: 'Chaleya',
  chaliya: 'Chaleya',
  chalya: 'Chaleya',
  'sauda is dil ka': 'Sauda Iss Dil Ka',
  'preet re': 'Preet Re',
  'kinna sona': 'Kinna Sohna',
  sayad: 'Shayad',
  satrangaa: 'Satranga',
  'raba janda': 'Rabba Janda'
};

export interface TrackScoreEvaluation {
  matchType: SearchMatchType | null;
  score: number;
  matchedLyricSnippet?: LyricMatchDetail;
}

/**
 * Evaluates track relevance with strict hierarchy:
 * 1. Exact song title (1000)
 * 2. Song title starts with query (800)
 * 3. Song title contains query (600)
 * 4. Multi-token title & artist match (550)
 * 5. Exact artist match (500)
 * 6. Artist starts with query (400)
 * 7. Artist contains query (350)
 * 8. Album match (250 exact, 200 contains)
 * 9. Other legitimate metadata (genre/language) (150)
 * 10. Genuine lyrics match (80)
 *
 * Rejects any song with score < 50.
 */
export function evaluateTrackRelevance(
  track: Track,
  normQuery: string,
  historyIds: Set<string> = new Set(),
  likedIds: Set<string> = new Set()
): TrackScoreEvaluation {
  if (!normQuery) {
    return { matchType: null, score: 0 };
  }

  const normTitle = normalizeSearchQuery(track.title);
  const normArtist = normalizeSearchQuery(track.artist);
  const normAlbum = normalizeSearchQuery(track.album || '');
  const normGenre = normalizeSearchQuery(track.genre || '');

  const compactQuery = normQuery.replace(/\s+/g, '');
  const compactTitle = normTitle.replace(/\s+/g, '');
  const compactArtist = normArtist.replace(/\s+/g, '');
  const compactAlbum = normAlbum.replace(/\s+/g, '');

  let matchType: SearchMatchType | null = null;
  let baseScore = 0;

  // 1. Exact song title match
  if (normTitle === normQuery || (compactQuery.length >= 2 && compactTitle === compactQuery)) {
    matchType = 'exact_title';
    baseScore = 1000;
  }
  // 2. Song title starts with query OR any word in title starts with query
  else if (normTitle.startsWith(normQuery) || (compactQuery.length >= 2 && compactTitle.startsWith(compactQuery))) {
    matchType = 'title_starts_with';
    baseScore = 800;
  }
  else if (normTitle.split(/\s+/).some((w) => w.startsWith(normQuery))) {
    matchType = 'title_starts_with';
    baseScore = 750;
  }
  // 3. Song title contains query
  else if (
    normTitle.includes(normQuery) ||
    normTitle.split(' ').includes(normQuery) ||
    (compactQuery.length >= 3 && compactTitle.includes(compactQuery))
  ) {
    matchType = 'title_contains';
    baseScore = 600;
  }
  // Title + artist multi-word match (e.g. "with you ap dhillon", "starboy weeknd")
  else if (matchesAllWords(`${normTitle} ${normArtist}`, normQuery)) {
    matchType = 'title_contains';
    baseScore = 550;
  }
  // 4. Exact artist match
  else if (normArtist === normQuery || (compactQuery.length >= 2 && compactArtist === compactQuery)) {
    matchType = 'exact_artist';
    baseScore = 500;
  }
  // 5. Artist starts with query OR any word in artist starts with query
  else if (normArtist.startsWith(normQuery) || (compactQuery.length >= 2 && compactArtist.startsWith(compactQuery))) {
    matchType = 'artist_starts_with';
    baseScore = 400;
  }
  else if (normArtist.split(/\s+/).some((w) => w.startsWith(normQuery))) {
    matchType = 'artist_starts_with';
    baseScore = 380;
  }
  // 6. Artist contains query
  else if (
    normArtist.includes(normQuery) ||
    normArtist.split(' ').includes(normQuery) ||
    (compactQuery.length >= 3 && compactArtist.includes(compactQuery))
  ) {
    matchType = 'artist_contains';
    baseScore = 350;
  }
  // 7. Album match
  else if (normAlbum && (normAlbum === normQuery || (compactQuery.length >= 2 && compactAlbum === compactQuery))) {
    matchType = 'album_match';
    baseScore = 250;
  } else if (normAlbum && (normAlbum.startsWith(normQuery) || normAlbum.includes(normQuery))) {
    matchType = 'album_match';
    baseScore = 200;
  }
  // 8. Other legitimate metadata match (genre, language, or phonetic)
  else if (normGenre && (normGenre === normQuery || normGenre.includes(normQuery))) {
    matchType = 'metadata_match';
    baseScore = 150;
  } else if (track.language && normalizeSearchQuery(track.language) === normQuery) {
    matchType = 'metadata_match';
    baseScore = 140;
  } else if (
    normQuery.length >= 3 &&
    (toPhoneticKey(normTitle).includes(toPhoneticKey(normQuery)) ||
      toPhoneticKey(normArtist).includes(toPhoneticKey(normQuery)))
  ) {
    matchType = 'metadata_match';
    baseScore = 130;
  }

  // 9. Check genuine lyrics match ONLY if query is at least 3 characters
  let matchedLyricSnippet: LyricMatchDetail | undefined = undefined;
  if (normQuery.length >= 3) {
    const genuineLyrics = lyricsService.getSearchableLyrics(track);
    for (const line of genuineLyrics) {
      if (line.text.startsWith('♪')) continue;
      const normLine = normalizeSearchQuery(line.text);
      if (normLine.includes(normQuery) || (normQuery.includes(' ') && matchesAllWords(normLine, normQuery))) {
        matchedLyricSnippet = {
          matchedLine: line.text,
          timestampSec: line.time
        };
        if (!matchType) {
          matchType = 'lyric_match';
          baseScore = 80;
        }
        break;
      }
    }
  }

  // If no match found or below threshold, check if track is from online search result
  if (!matchType || baseScore < 50) {
    if (track.source === 'itunes' || track.source === 'youtube' || track.source === 'piped' || track.videoId) {
      matchType = 'metadata_match';
      baseScore = 120;
    } else {
      return { matchType: null, score: 0 };
    }
  }

  // Minor tie-breakers for genuinely relevant results only (max 10 points)
  let finalScore = baseScore;
  if (historyIds.has(track.id)) finalScore += 4;
  if (likedIds.has(track.id) || track.isFavorite) finalScore += 3;
  if (track.playCount && track.playCount > 1000) {
    finalScore += Math.min(3, Math.log10(track.playCount));
  }

  return {
    matchType,
    score: finalScore,
    matchedLyricSnippet
  };
}

export interface SearchSuggestionItem {
  id: string;
  type: 'song' | 'artist' | 'album' | 'playlist' | 'query';
  title: string;
  subtitle?: string;
  coverUrl?: string;
  targetQuery?: string;
  track?: Track;
  artist?: Artist;
  album?: Album;
  playlist?: Playlist | MusicMix;
}

export const searchEngine = {
  /**
   * Filter and rank tracks strictly by relevance to the query
   */
  rankAndFilterTracks(
    tracks: Track[],
    rawQuery: string,
    historyTrackIds: Set<string> = getPlaybackHistoryIds(),
    likedTrackIds: Set<string> = getLikedTrackIds()
  ): NormalizedSearchResult[] {
    const normQuery = normalizeSearchQuery(rawQuery);
    if (!normQuery) return [];

    const results: NormalizedSearchResult[] = [];
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();

    for (const track of tracks) {
      if (!track || !track.title) continue;

      const evalResult = evaluateTrackRelevance(track, normQuery, historyTrackIds, likedTrackIds);
      if (!evalResult.matchType || evalResult.score < 50) continue;

      const dedupeKey = `${normalizeSearchQuery(track.title)}|${normalizeSearchQuery(track.artist)}`;
      if (seenIds.has(track.id) || seenKeys.has(dedupeKey)) continue;

      seenIds.add(track.id);
      seenKeys.add(dedupeKey);

      results.push({
        ...track,
        thumbnail: track.coverUrl || track.albumArt || '',
        matchType: evalResult.matchType,
        relevanceScore: evalResult.score,
        matchScore: evalResult.score,
        matchedLyricSnippet: evalResult.matchedLyricSnippet,
        lyricMatch: evalResult.matchedLyricSnippet
      });
    }

    results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    return results;
  },

  /**
   * Detect common typographical errors
   */
  detectTypoCorrection(rawQuery: string): string | null {
    const q = normalizeSearchQuery(rawQuery);
    if (!q || q.length < 3) return null;

    if (KNOWN_TYPO_CORRECTIONS[q]) {
      return KNOWN_TYPO_CORRECTIONS[q];
    }

    const words = q.split(' ');
    let changed = false;
    const correctedWords = words.map((w) => {
      if (KNOWN_TYPO_CORRECTIONS[w]) {
        changed = true;
        return KNOWN_TYPO_CORRECTIONS[w];
      }
      return w;
    });

    if (changed) {
      return correctedWords.join(' ');
    }

    return null;
  },

  /**
   * Instant suggestions / autocomplete generator
   */
  getSuggestions(
    rawQuery: string,
    catalog: Track[] = TRACKS,
    userPlaylists: Playlist[] = getUserPlaylists()
  ): SearchSuggestionItem[] {
    const q = normalizeSearchQuery(rawQuery);
    if (!q || q.length < 1) return [];

    const suggestions: SearchSuggestionItem[] = [];
    const seenTitles = new Set<string>();

    const allAlbums = extractAlbums(catalog);
    const allArtists = extractArtists(catalog, allAlbums);

    // 1. Match Artists
    for (const artist of allArtists) {
      const normArt = normalizeSearchQuery(artist.name);
      if (normArt.startsWith(q) || normArt === q) {
        suggestions.push({
          id: `sug-art-${artist.id}`,
          type: 'artist',
          title: artist.name,
          subtitle: `${artist.trackCount} tracks • Artist`,
          coverUrl: artist.avatarUrl,
          targetQuery: artist.name,
          artist
        });
        seenTitles.add(artist.name.toLowerCase());
        if (suggestions.length >= 2) break;
      }
    }

    // 2. Match Songs
    const matchedSongs = this.rankAndFilterTracks(catalog, rawQuery);
    for (const track of matchedSongs) {
      if (suggestions.length >= 6) break;
      if (!seenTitles.has(track.title.toLowerCase())) {
        seenTitles.add(track.title.toLowerCase());
        suggestions.push({
          id: `sug-trk-${track.id}`,
          type: 'song',
          title: track.title,
          subtitle: `${track.artist} • ${track.album}`,
          coverUrl: track.coverUrl || track.albumArt,
          targetQuery: track.title,
          track
        });
      }
    }

    // 3. Match Albums
    for (const album of allAlbums) {
      if (suggestions.length >= 7) break;
      const normAlb = normalizeSearchQuery(album.title);
      if (normAlb.startsWith(q) && !seenTitles.has(album.title.toLowerCase())) {
        seenTitles.add(album.title.toLowerCase());
        suggestions.push({
          id: `sug-alb-${album.id}`,
          type: 'album',
          title: album.title,
          subtitle: `${album.artist} • Album`,
          coverUrl: album.coverUrl,
          targetQuery: album.title,
          album
        });
      }
    }

    // 4. Synthesize Related Query Suggestions for the search word
    const trimmed = rawQuery.trim();
    if (trimmed.length >= 1) {
      const relatedPhrases = [
        `${trimmed} song`,
        `${trimmed} remix`,
        `${trimmed} lofi`,
        `${trimmed} lyrics`,
        `${trimmed} slowed & reverb`
      ];
      for (const phrase of relatedPhrases) {
        if (suggestions.length >= 12) break;
        if (!seenTitles.has(phrase.toLowerCase())) {
          seenTitles.add(phrase.toLowerCase());
          suggestions.push({
            id: `sug-query-${phrase.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            type: 'query',
            title: phrase,
            subtitle: 'Related Search',
            targetQuery: phrase
          });
        }
      }
    }

    return suggestions;
  },

  /**
   * Main Search entrypoint: searches local catalog and provides categorized results
   */
  search(
    rawQuery: string,
    catalog: Track[] = TRACKS,
    userPlaylists: Playlist[] = getUserPlaylists()
  ): ContextualSearchResults {
    const cleanQuery = normalizeSearchQuery(rawQuery);

    if (!cleanQuery) {
      return {
        query: rawQuery,
        hasTypoCorrection: false,
        songs: [],
        albums: [],
        artists: [],
        playlists: []
      };
    }

    const correctedQuery = this.detectTypoCorrection(rawQuery);
    const hasTypoCorrection = Boolean(correctedQuery && normalizeSearchQuery(correctedQuery) !== cleanQuery);

    const historyTrackIds = getPlaybackHistoryIds();
    const likedTrackIds = getLikedTrackIds();

    // 1. Search Songs
    const dedupedCatalog = deduplicateTracks(catalog);
    const songResults = this.rankAndFilterTracks(dedupedCatalog, rawQuery, historyTrackIds, likedTrackIds);

    // 2. Search Albums
    const allAlbums = extractAlbums(dedupedCatalog);
    const albumResults: Album[] = [];
    const seenAlbumTitles = new Set<string>();

    allAlbums.forEach((alb) => {
      const normAlbTitle = normalizeSearchQuery(alb.title);
      const normAlbArtist = normalizeSearchQuery(alb.artist);
      const isMatch =
        normAlbTitle === cleanQuery ||
        normAlbTitle.startsWith(cleanQuery) ||
        normAlbTitle.includes(cleanQuery) ||
        normAlbArtist === cleanQuery ||
        normAlbArtist.startsWith(cleanQuery) ||
        normAlbArtist.includes(cleanQuery);

      if (isMatch && !seenAlbumTitles.has(normAlbTitle)) {
        seenAlbumTitles.add(normAlbTitle);
        albumResults.push(alb);
      }
    });

    // 3. Search Artists
    const allArtists = extractArtists(dedupedCatalog, allAlbums);
    const artistResults: Artist[] = [];
    const seenArtistNames = new Set<string>();

    allArtists.forEach((art) => {
      const normArtName = normalizeSearchQuery(art.name);
      const isMatch =
        normArtName === cleanQuery ||
        normArtName.startsWith(cleanQuery) ||
        normArtName.includes(cleanQuery);

      if (isMatch && !seenArtistNames.has(normArtName)) {
        seenArtistNames.add(normArtName);
        artistResults.push(art);
      }
    });

    // 4. Search Playlists & Personalized Mixes
    const playlistResults: (Playlist | MusicMix)[] = [];
    userPlaylists.forEach((pl) => {
      const normName = normalizeSearchQuery(pl.name);
      const normDesc = normalizeSearchQuery(pl.description || '');
      if (normName.includes(cleanQuery) || normDesc.includes(cleanQuery)) {
        playlistResults.push(pl);
      }
    });

    YTM_PERSONALIZED_MIXES.forEach((mix) => {
      const normTitle = normalizeSearchQuery(mix.title);
      const normSub = normalizeSearchQuery(mix.subtitle);
      if (normTitle.includes(cleanQuery) || normSub.includes(cleanQuery)) {
        playlistResults.push(mix);
      }
    });

    // 5. Determine Top Result
    let topResult: ContextualSearchResults['topResult'] = undefined;

    const topArtist = artistResults[0];
    const topSong = songResults[0];
    const topAlbum = albumResults[0];

    // Priority: Exact artist match usually wins in music apps, else top scored song
    if (topArtist && normalizeSearchQuery(topArtist.name) === cleanQuery) {
      topResult = { type: 'artist', item: topArtist };
    } else if (topSong && (topSong.relevanceScore || 0) >= 200) {
      topResult = { type: 'song', item: topSong };
    } else if (topArtist && normalizeSearchQuery(topArtist.name).startsWith(cleanQuery)) {
      topResult = { type: 'artist', item: topArtist };
    } else if (topAlbum && normalizeSearchQuery(topAlbum.title) === cleanQuery) {
      topResult = { type: 'album', item: topAlbum };
    } else if (topSong && (topSong.relevanceScore || 0) >= 50 && topSong.matchType !== 'lyric_match') {
      topResult = { type: 'song', item: topSong };
    }

    return {
      query: rawQuery,
      correctedQuery: hasTypoCorrection ? correctedQuery || undefined : undefined,
      hasTypoCorrection,
      topResult,
      songs: songResults,
      albums: albumResults,
      artists: artistResults,
      playlists: playlistResults
    };
  }
};
