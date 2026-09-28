import { Track, Album, Artist } from '../types';
import { RELATED_ALBUMS } from '../data/musicData';

export interface EnrichedAlbum extends Album {
  tracks: Track[];
  totalSec: number;
  totalDuration: string;
}

export interface EnrichedArtist extends Artist {
  tracks: Track[];
  albums: EnrichedAlbum[];
}

/**
 * Format relative timestamp for history entries
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);

  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `${hours}h ago`;
  }
  if (diffSec < 172800) return 'Yesterday';
  const days = Math.floor(diffSec / 86400);
  if (days < 7) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatTotalDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }
  return `${minutes} min`;
}

/**
 * Normalize and clean album titles so soundtrack and single variations group cleanly
 */
export function normalizeAlbumTitle(rawAlbum?: string, fallbackTitle?: string): string {
  if (!rawAlbum || rawAlbum.trim() === '') return fallbackTitle || 'Featured Project';
  let clean = rawAlbum.trim();
  
  // Extract "(From "AlbumName")"
  const fromMatch = clean.match(/\(From\s+["']?([^"'()]+)["']?\)/i);
  if (fromMatch && fromMatch[1]) {
    return fromMatch[1].trim();
  }

  // Strip soundtrack, edition, single and EP tags
  clean = clean.replace(/\(Original Motion Picture Soundtrack\)/i, '');
  clean = clean.replace(/\(Original Soundtrack\)/i, '');
  clean = clean.replace(/\(Deluxe.*?\)/i, '');
  clean = clean.replace(/\(feat\..*?\)/i, '');
  clean = clean.replace(/\(Lofi Flip\)/i, '');
  clean = clean.replace(/-\s*(Single|EP)/i, '');
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean || fallbackTitle || 'Featured Project';
}

/**
 * Extract and group all Albums from the music library with genuine track collections
 */
export function extractAlbums(tracks: Track[]): EnrichedAlbum[] {
  const albumMap = new Map<string, { album: Album; tracks: Track[] }>();

  // 1. Group tracks by normalized album title
  tracks.forEach((track) => {
    const rawAlbum = track.album || track.title;
    const normTitle = normalizeAlbumTitle(rawAlbum, track.title);
    const key = normTitle.toLowerCase();

    if (!albumMap.has(key)) {
      albumMap.set(key, {
        album: {
          id: `alb-${encodeURIComponent(key)}`,
          title: normTitle,
          artist: track.artist,
          year: track.year || '2024',
          coverUrl: track.coverUrl,
          trackCount: 0
        },
        tracks: []
      });
    }

    const entry = albumMap.get(key)!;
    if (!entry.tracks.some((t) => t.id === track.id)) {
      entry.tracks.push(track);
    }
  });

  // 2. Incorporate predefined RELATED_ALBUMS metadata and link all corresponding artist tracks
  RELATED_ALBUMS.forEach((rel) => {
    const key = rel.title.trim().toLowerCase();
    const existing = albumMap.get(key);

    // Identify artists from rel.artist split
    const artistParts = rel.artist.split(/[,&/|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);

    if (existing) {
      existing.album = {
        ...existing.album,
        coverUrl: rel.coverUrl || existing.album.coverUrl,
        year: rel.year || existing.album.year,
        artist: rel.artist || existing.album.artist
      };
      // Supplement with any artist matching tracks if existing has very few tracks
      if (existing.tracks.length < 3) {
        tracks.forEach((t) => {
          if (!existing.tracks.some((et) => et.id === t.id)) {
            const matchesArtist = artistParts.some((ap) => t.artist.toLowerCase().includes(ap));
            const matchesAlbum = (t.album || '').toLowerCase().includes(key);
            if (matchesAlbum || matchesArtist) {
              existing.tracks.push(t);
            }
          }
        });
      }
    } else {
      // Find tracks matching album title or artists
      const matchingTracks = tracks.filter((t) => {
        const tAlb = (t.album || '').toLowerCase();
        const tTitle = t.title.toLowerCase();
        const matchesAlb = tAlb.includes(key) || tTitle.includes(key);
        const matchesArtist = artistParts.some((ap) => t.artist.toLowerCase().includes(ap));
        return matchesAlb || matchesArtist;
      });

      if (matchingTracks.length > 0) {
        albumMap.set(key, {
          album: rel,
          tracks: matchingTracks
        });
      }
    }
  });

  return Array.from(albumMap.values())
    .filter(({ tracks: albTracks }) => albTracks.length > 0)
    .map(({ album, tracks: albTracks }) => {
      const totalSec = albTracks.reduce((sum, t) => sum + (t.durationSec || 200), 0);
      return {
        ...album,
        trackCount: albTracks.length,
        tracks: albTracks,
        totalSec,
        totalDuration: formatTotalDuration(totalSec)
      };
    })
    .sort((a, b) => b.tracks.length - a.tracks.length);
}

/**
 * Extract and index all Artists with avatars, songs, and albums (completely subscription-free)
 */
export function extractArtists(tracks: Track[], allAlbums: EnrichedAlbum[]): EnrichedArtist[] {
  const artistMap = new Map<string, { name: string; tracks: Track[]; coverUrl: string; genres: Set<string> }>();

  tracks.forEach((track) => {
    // Split combined artist names (e.g. "Arijit Singh & Pritam" or "AP Dhillon, Gurinder Gill")
    const rawNames = track.artist.split(/[,&/|]/).map((s) => s.trim()).filter(Boolean);
    const primaryName = rawNames[0] || track.artist;

    [primaryName].forEach((name) => {
      const key = name.toLowerCase();
      if (!artistMap.has(key)) {
        artistMap.set(key, {
          name,
          tracks: [],
          coverUrl: track.coverUrl,
          genres: new Set()
        });
      }

      const entry = artistMap.get(key)!;
      if (!entry.tracks.some((t) => t.id === track.id)) {
        entry.tracks.push(track);
      }
      if (track.genre) {
        entry.genres.add(track.genre);
      }
    });
  });

  return Array.from(artistMap.values())
    .map(({ name, tracks: artTracks, coverUrl, genres }) => {
      const matchingAlbums = allAlbums.filter(
        (alb) => alb.artist.toLowerCase().includes(name.toLowerCase()) || alb.tracks.some((t) => t.artist.toLowerCase().includes(name.toLowerCase()))
      );

      const monthlyListeners = `${(artTracks.length * 2.4 + 1.2).toFixed(1)}M monthly listeners`;

      return {
        id: `artist-${encodeURIComponent(name.toLowerCase())}`,
        name,
        avatarUrl: coverUrl,
        monthlyListeners,
        trackCount: artTracks.length,
        albumCount: matchingAlbums.length || 1,
        genres: Array.from(genres),
        tracks: artTracks,
        albums: matchingAlbums
      };
    })
    .sort((a, b) => b.tracks.length - a.tracks.length);
}

/**
 * Compute detailed listening history statistics
 */
export function calculateHistoryStats(history: Track[]) {
  const totalTracks = history.length;
  let totalSeconds = 0;
  let totalCompletion = 0;
  const artistCounts: Record<string, number> = {};
  const genreCounts: Record<string, number> = {};

  history.forEach((t) => {
    const playSec = t.playDurationSec || t.durationSec || 200;
    totalSeconds += playSec;
    totalCompletion += (t.completionPercentage ?? 100);

    const rawArtist = t.artist.split(/[,&/]/)[0].trim();
    artistCounts[rawArtist] = (artistCounts[rawArtist] || 0) + (t.playCount || 1);
    if (t.genre) {
      genreCounts[t.genre] = (genreCounts[t.genre] || 0) + (t.playCount || 1);
    }
  });

  let topArtist = 'None';
  let maxArtistCount = 0;
  Object.entries(artistCounts).forEach(([art, count]) => {
    if (count > maxArtistCount) {
      maxArtistCount = count;
      topArtist = art;
    }
  });

  let topGenre = 'Diverse';
  let maxGenreCount = 0;
  Object.entries(genreCounts).forEach(([gen, count]) => {
    if (count > maxGenreCount) {
      maxGenreCount = count;
      topGenre = gen;
    }
  });

  const avgCompletion = totalTracks > 0 ? Math.round(totalCompletion / totalTracks) : 0;
  const hours = (totalSeconds / 3600).toFixed(1);

  return {
    totalTracks,
    totalSeconds,
    totalHoursFormatted: hours + ' hrs',
    avgCompletion,
    topArtist,
    topGenre
  };
}
