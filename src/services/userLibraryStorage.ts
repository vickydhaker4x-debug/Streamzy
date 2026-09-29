import { Track, Playlist, HistoryRecord, SettingsState, Album, Artist } from '../types';
import { sanitizeTrackForPersistence } from './musicNormalizationService';

const SCHEMA_VERSION_KEY = 'vd_library_schema_version';
const CURRENT_SCHEMA_VERSION = 2;

const KEYS = {
  FAVORITES: 'vd_favorite_track_ids',
  LIKED_TRACKS_FULL: 'vd_liked_tracks_full_v1',
  PLAYLISTS: 'vd_user_playlists',
  HISTORY: 'vd_listening_history_v2',
  LEGACY_HISTORY: 'vd_playback_history_v1',
  SAVED_ALBUMS: 'vd_saved_album_ids',
  SAVED_ALBUMS_FULL: 'vd_saved_albums_full_v1',
  SAVED_ARTISTS: 'vd_saved_artist_ids',
  SAVED_ARTISTS_FULL: 'vd_saved_artists_full_v1',
  SETTINGS: 'vd_user_settings_v3',
  USER_NAME: 'vd_user_name',
  SHUFFLE: 'vd_is_shuffle',
  INFINITE_AUTOPLAY: 'vd_infinite_autoplay'
};

export interface SavedAlbumRecord {
  id: string;
  title: string;
  artist: string;
  year?: string;
  coverUrl?: string;
  savedAt: number;
}

export interface SavedArtistRecord {
  id: string;
  name: string;
  avatarUrl?: string;
  savedAt: number;
}

type LibraryChangeListener = () => void;

class UserLibraryStorage {
  private favoriteIds: Set<string> = new Set();
  private likedTracksMap: Map<string, Track> = new Map();
  private playlistsMap: Map<string, Playlist> = new Map();
  private savedAlbumsMap: Map<string, SavedAlbumRecord> = new Map();
  private savedArtistsMap: Map<string, SavedArtistRecord> = new Map();
  private listeners: Set<LibraryChangeListener> = new Set();

  constructor() {
    this.initStorage();
  }

  /**
   * Initialize and load saved state from localStorage with migration
   */
  private initStorage() {
    if (typeof window === 'undefined') return;

    try {
      this.runMigrationIfNeeded();

      // 1. Load Favorite Track IDs & Full Liked Tracks
      const favRaw = localStorage.getItem(KEYS.FAVORITES);
      if (favRaw) {
        const parsed = JSON.parse(favRaw);
        if (Array.isArray(parsed)) {
          this.favoriteIds = new Set(parsed);
        }
      }

      const fullLikedRaw = localStorage.getItem(KEYS.LIKED_TRACKS_FULL);
      if (fullLikedRaw) {
        const parsed = JSON.parse(fullLikedRaw);
        if (Array.isArray(parsed)) {
          parsed.forEach((t: Track) => {
            if (t && t.id) {
              this.likedTracksMap.set(t.id, sanitizeTrackForPersistence(t));
            }
          });
        }
      }

      // 2. Load Playlists
      const plRaw = localStorage.getItem(KEYS.PLAYLISTS);
      if (plRaw) {
        const parsed = JSON.parse(plRaw);
        if (Array.isArray(parsed)) {
          parsed.forEach((p: Playlist) => {
            if (p && p.id) {
              this.playlistsMap.set(p.id, {
                ...p,
                tracks: (p.tracks || []).map((t) => sanitizeTrackForPersistence(t))
              });
            }
          });
        }
      }

      // 3. Load Saved Albums
      const albRaw = localStorage.getItem(KEYS.SAVED_ALBUMS_FULL);
      if (albRaw) {
        const parsed = JSON.parse(albRaw);
        if (Array.isArray(parsed)) {
          parsed.forEach((a: SavedAlbumRecord) => {
            if (a && a.id) {
              this.savedAlbumsMap.set(a.id, a);
            }
          });
        }
      }

      // 4. Load Saved Artists
      const artRaw = localStorage.getItem(KEYS.SAVED_ARTISTS_FULL);
      if (artRaw) {
        const parsed = JSON.parse(artRaw);
        if (Array.isArray(parsed)) {
          parsed.forEach((ar: SavedArtistRecord) => {
            if (ar && ar.id) {
              this.savedArtistsMap.set(ar.id, ar);
            }
          });
        }
      }
    } catch (err) {
      console.warn('[UserLibraryStorage] Error reading initial storage:', err);
    }
  }

  /**
   * Safe migration from legacy versions
   */
  private runMigrationIfNeeded() {
    try {
      const verRaw = localStorage.getItem(SCHEMA_VERSION_KEY);
      const currentVer = verRaw ? parseInt(verRaw, 10) : 1;

      if (currentVer < CURRENT_SCHEMA_VERSION) {
        console.log(`[UserLibraryStorage] Migrating library schema from v${currentVer} -> v${CURRENT_SCHEMA_VERSION}`);
        localStorage.setItem(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION.toString());
      }
    } catch (e) {
      console.warn('[UserLibraryStorage] Migration exception:', e);
    }
  }

  public subscribe(listener: LibraryChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try { fn(); } catch {}
    });
  }

  // --- LIKED TRACKS ---

  public getFavoriteTrackIds(): Set<string> {
    return new Set(this.favoriteIds);
  }

  public isLiked(trackId: string): boolean {
    return this.favoriteIds.has(trackId);
  }

  public getLikedTracks(): Track[] {
    return Array.from(this.likedTracksMap.values());
  }

  public toggleLike(track: Track): boolean {
    if (!track || !track.id) return false;
    const isNowLiked = !this.favoriteIds.has(track.id);

    if (isNowLiked) {
      this.favoriteIds.add(track.id);
      this.likedTracksMap.set(track.id, sanitizeTrackForPersistence({ ...track, isFavorite: true }));
    } else {
      this.favoriteIds.delete(track.id);
      this.likedTracksMap.delete(track.id);
    }

    this.persistLikes();
    this.notify();
    return isNowLiked;
  }

  public setLikeState(track: Track, isLiked: boolean) {
    if (!track || !track.id) return;
    if (isLiked) {
      this.favoriteIds.add(track.id);
      this.likedTracksMap.set(track.id, sanitizeTrackForPersistence({ ...track, isFavorite: true }));
    } else {
      this.favoriteIds.delete(track.id);
      this.likedTracksMap.delete(track.id);
    }

    this.persistLikes();
    this.notify();
  }

  private persistLikes() {
    try {
      localStorage.setItem(KEYS.FAVORITES, JSON.stringify(Array.from(this.favoriteIds)));
      localStorage.setItem(KEYS.LIKED_TRACKS_FULL, JSON.stringify(Array.from(this.likedTracksMap.values())));
    } catch (e) {
      console.warn('[UserLibraryStorage] Failed to persist likes:', e);
    }
  }

  // --- PLAYLISTS ---

  public getPlaylists(): Playlist[] {
    return Array.from(this.playlistsMap.values());
  }

  public savePlaylist(playlist: Playlist) {
    if (!playlist || !playlist.id) return;
    const sanitized: Playlist = {
      ...playlist,
      tracks: (playlist.tracks || []).map((t) => sanitizeTrackForPersistence(t))
    };
    this.playlistsMap.set(playlist.id, sanitized);
    this.persistPlaylists();
    this.notify();
  }

  public deletePlaylist(playlistId: string) {
    if (this.playlistsMap.has(playlistId)) {
      this.playlistsMap.delete(playlistId);
      this.persistPlaylists();
      this.notify();
    }
  }

  private persistPlaylists() {
    try {
      localStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(Array.from(this.playlistsMap.values())));
    } catch (e) {
      console.warn('[UserLibraryStorage] Failed to persist playlists:', e);
    }
  }

  // --- SAVED ALBUMS ---

  public getSavedAlbums(): SavedAlbumRecord[] {
    return Array.from(this.savedAlbumsMap.values());
  }

  public isAlbumSaved(albumId: string): boolean {
    return this.savedAlbumsMap.has(albumId);
  }

  public toggleSaveAlbum(album: { id: string; title: string; artist: string; year?: string; coverUrl?: string }): boolean {
    if (!album || !album.id) return false;
    const isSaved = this.savedAlbumsMap.has(album.id);

    if (isSaved) {
      this.savedAlbumsMap.delete(album.id);
    } else {
      this.savedAlbumsMap.set(album.id, {
        id: album.id,
        title: album.title,
        artist: album.artist,
        year: album.year,
        coverUrl: album.coverUrl,
        savedAt: Date.now()
      });
    }

    this.persistAlbums();
    this.notify();
    return !isSaved;
  }

  private persistAlbums() {
    try {
      const albums = Array.from(this.savedAlbumsMap.values());
      localStorage.setItem(KEYS.SAVED_ALBUMS_FULL, JSON.stringify(albums));
      localStorage.setItem(KEYS.SAVED_ALBUMS, JSON.stringify(albums.map((a) => a.id)));
    } catch (e) {
      console.warn('[UserLibraryStorage] Failed to persist saved albums:', e);
    }
  }

  // --- SAVED ARTISTS ---

  public getSavedArtists(): SavedArtistRecord[] {
    return Array.from(this.savedArtistsMap.values());
  }

  public isArtistSaved(artistId: string): boolean {
    return this.savedArtistsMap.has(artistId);
  }

  public toggleSaveArtist(artist: { id: string; name: string; avatarUrl?: string }): boolean {
    if (!artist || !artist.id) return false;
    const isSaved = this.savedArtistsMap.has(artist.id);

    if (isSaved) {
      this.savedArtistsMap.delete(artist.id);
    } else {
      this.savedArtistsMap.set(artist.id, {
        id: artist.id,
        name: artist.name,
        avatarUrl: artist.avatarUrl,
        savedAt: Date.now()
      });
    }

    this.persistArtists();
    this.notify();
    return !isSaved;
  }

  private persistArtists() {
    try {
      const artists = Array.from(this.savedArtistsMap.values());
      localStorage.setItem(KEYS.SAVED_ARTISTS_FULL, JSON.stringify(artists));
      localStorage.setItem(KEYS.SAVED_ARTISTS, JSON.stringify(artists.map((a) => a.id)));
    } catch (e) {
      console.warn('[UserLibraryStorage] Failed to persist saved artists:', e);
    }
  }
}

export const userLibraryStorage = new UserLibraryStorage();
