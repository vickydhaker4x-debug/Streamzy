/**
 * Module 5: Database Schema & Relational Data Engine
 * 
 * Defines highly optimized tables and schemas for:
 * - Users (Authentication, profiles, credentials)
 * - Tracks (Audio metadata, catalog, stream stats)
 * - Playlists (User created and curated collections)
 * - PlayHistory (Granular telemetry, listens, skips, completions)
 * - Queues (Active player queues across devices)
 * 
 * Backed by a high-performance in-memory relational store with disk persistence
 * and formal PostgreSQL DDL definitions for production migrations.
 */

import fs from 'fs';
import path from 'path';

// ==========================================
// 1. POSTGRESQL RELATIONAL SCHEMA DEFINITION
// ==========================================
export const POSTGRESQL_SCHEMA_DDL = `
-- PostgreSQL DDL for Music App Backend (Module 5)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(128) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'artist')),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. TRACKS TABLE
CREATE TABLE IF NOT EXISTS tracks (
  id VARCHAR(128) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  album VARCHAR(255),
  duration_sec INTEGER NOT NULL,
  cover_url TEXT,
  audio_url TEXT,
  genre VARCHAR(64),
  release_year VARCHAR(10),
  play_count BIGINT DEFAULT 0,
  skip_count BIGINT DEFAULT 0,
  completion_count BIGINT DEFAULT 0,
  total_listen_duration_sec BIGINT DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_play_count ON tracks(play_count DESC);

-- 3. PLAYLISTS TABLE
CREATE TABLE IF NOT EXISTS playlists (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  cover_url TEXT,
  track_ids JSONB DEFAULT '[]'::jsonb,
  track_count INTEGER DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlists_updated_at ON playlists(updated_at DESC);

-- 4. PLAY HISTORY & TELEMETRY TABLE
CREATE TABLE IF NOT EXISTS play_history (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  track_id VARCHAR(128) REFERENCES tracks(id) ON DELETE CASCADE,
  played_at BIGINT NOT NULL,
  duration_listened_sec NUMERIC(10,2) NOT NULL,
  track_duration_sec INTEGER NOT NULL,
  completed BOOLEAN DEFAULT false,
  skipped BOOLEAN DEFAULT false,
  skip_position_sec NUMERIC(10,2),
  skip_reason VARCHAR(64),
  loop_count INTEGER DEFAULT 0,
  time_of_day VARCHAR(20) CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'night')),
  hour SMALLINT,
  device_id VARCHAR(128),
  device_platform VARCHAR(32)
);

CREATE INDEX IF NOT EXISTS idx_play_history_user ON play_history(user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_play_history_track ON play_history(track_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_play_history_telemetry ON play_history(track_id, skipped, completed);

-- 5. ACTIVE PLAYER QUEUES TABLE
CREATE TABLE IF NOT EXISTS queues (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_track_id VARCHAR(128) REFERENCES tracks(id) ON DELETE SET NULL,
  queue_track_ids JSONB DEFAULT '[]'::jsonb,
  current_index INTEGER DEFAULT 0,
  repeat_mode VARCHAR(10) DEFAULT 'off' CHECK (repeat_mode IN ('off', 'all', 'one')),
  shuffle BOOLEAN DEFAULT false,
  progress_sec NUMERIC(10,2) DEFAULT 0,
  updated_at BIGINT NOT NULL,
  device_id VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_queues_user_id ON queues(user_id);
`;

// ==========================================
// 2. TYPES & ENTITY INTERFACES
// ==========================================
export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  displayName: string;
  avatarUrl?: string;
  role: 'user' | 'admin' | 'artist';
  createdAt: number;
  updatedAt: number;
}

export interface TrackEntity {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
  coverUrl?: string;
  audioUrl?: string;
  genre?: string;
  releaseYear?: string;
  playCount: number;
  skipCount: number;
  completionCount: number;
  totalListenDurationSec: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlaylistEntity {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isPublic: boolean;
  coverUrl?: string;
  trackIds: string[];
  trackCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlayHistoryEntity {
  id: string;
  userId: string;
  trackId: string;
  playedAt: number;
  durationListenedSec: number;
  trackDurationSec: number;
  completed: boolean;
  skipped: boolean;
  skipPositionSec?: number;
  skipReason?: string;
  loopCount: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  hour: number;
  deviceId?: string;
  devicePlatform?: string;
}

export interface QueueEntity {
  id: string;
  userId: string;
  currentTrackId: string | null;
  queueTrackIds: string[];
  currentIndex: number;
  repeatMode: 'off' | 'all' | 'one';
  shuffle: boolean;
  progressSec: number;
  updatedAt: number;
  deviceId?: string;
}

// ==========================================
// 3. FAST-READ OPTIMIZED RELATIONAL ENGINE
// ==========================================
const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const DB_STORE_FILE = path.join(DATA_DIR, 'relational_schema_store.json');

class DatabaseEngine {
  public users: Map<string, UserEntity> = new Map();
  public tracks: Map<string, TrackEntity> = new Map();
  public playlists: Map<string, PlaylistEntity> = new Map();
  public playHistory: Map<string, PlayHistoryEntity> = new Map();
  public queues: Map<string, QueueEntity> = new Map();

  // Optimized Secondary Indexes for fast-read queries
  private usersByEmail: Map<string, string> = new Map();
  private playlistsByUser: Map<string, Set<string>> = new Map();
  private historyByUser: Map<string, string[]> = new Map();
  private historyByTrack: Map<string, string[]> = new Map();

  constructor() {
    this.ensureDataDir();
    this.loadFromDisk();
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn('[DatabaseEngine] Unable to create data dir:', e);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(DB_STORE_FILE)) {
        const raw = fs.readFileSync(DB_STORE_FILE, 'utf-8');
        const data = JSON.parse(raw);
        
        if (data.users) {
          Object.values(data.users).forEach((u: any) => this.insertUser(u, false));
        }
        if (data.tracks) {
          Object.values(data.tracks).forEach((t: any) => this.insertTrack(t, false));
        }
        if (data.playlists) {
          Object.values(data.playlists).forEach((p: any) => this.insertPlaylist(p, false));
        }
        if (data.playHistory) {
          Object.values(data.playHistory).forEach((h: any) => this.insertHistory(h, false));
        }
        if (data.queues) {
          Object.values(data.queues).forEach((q: any) => this.queues.set(q.userId, q));
        }
        console.log(`[DatabaseEngine] Loaded ${this.users.size} users, ${this.tracks.size} tracks, ${this.playHistory.size} history records.`);
      }
    } catch (err) {
      console.warn('[DatabaseEngine] Disk load warning (using in-memory fallback):', err);
    }
  }

  public saveToDisk() {
    try {
      const payload = {
        users: Object.fromEntries(this.users),
        tracks: Object.fromEntries(this.tracks),
        playlists: Object.fromEntries(this.playlists),
        playHistory: Object.fromEntries(this.playHistory),
        queues: Object.fromEntries(this.queues),
        savedAt: Date.now()
      };
      fs.writeFileSync(DB_STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[DatabaseEngine] Failed to write database to disk:', err);
    }
  }

  // --- Users Table Operations ---
  public insertUser(user: UserEntity, persist = true): UserEntity {
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email.toLowerCase(), user.id);
    if (persist) this.saveToDisk();
    return user;
  }

  public findUserById(id: string): UserEntity | undefined {
    return this.users.get(id);
  }

  public findUserByEmail(email: string): UserEntity | undefined {
    const id = this.usersByEmail.get(email.toLowerCase());
    return id ? this.users.get(id) : undefined;
  }

  // --- Tracks Table Operations ---
  public insertTrack(track: TrackEntity, persist = true): TrackEntity {
    this.tracks.set(track.id, track);
    if (persist) this.saveToDisk();
    return track;
  }

  public findTrackById(id: string): TrackEntity | undefined {
    return this.tracks.get(id);
  }

  public getAllTracks(): TrackEntity[] {
    return Array.from(this.tracks.values());
  }

  public updateTrackTelemetry(
    trackId: string,
    delta: { played?: boolean; skipped?: boolean; completed?: boolean; durationSec?: number }
  ) {
    const track = this.tracks.get(trackId);
    if (track) {
      if (delta.played) track.playCount++;
      if (delta.skipped) track.skipCount++;
      if (delta.completed) track.completionCount++;
      if (delta.durationSec) track.totalListenDurationSec += delta.durationSec;
      track.updatedAt = Date.now();
      this.saveToDisk();
    }
  }

  // --- Playlists Table Operations ---
  public insertPlaylist(playlist: PlaylistEntity, persist = true): PlaylistEntity {
    this.playlists.set(playlist.id, playlist);
    if (!this.playlistsByUser.has(playlist.userId)) {
      this.playlistsByUser.set(playlist.userId, new Set());
    }
    this.playlistsByUser.get(playlist.userId)!.add(playlist.id);
    if (persist) this.saveToDisk();
    return playlist;
  }

  public findPlaylistsByUserId(userId: string): PlaylistEntity[] {
    const ids = this.playlistsByUser.get(userId);
    if (!ids) return [];
    const res: PlaylistEntity[] = [];
    ids.forEach((id) => {
      const p = this.playlists.get(id);
      if (p) res.push(p);
    });
    return res;
  }

  // --- PlayHistory & Telemetry Operations ---
  public insertHistory(record: PlayHistoryEntity, persist = true): PlayHistoryEntity {
    this.playHistory.set(record.id, record);
    
    // User index
    if (!this.historyByUser.has(record.userId)) {
      this.historyByUser.set(record.userId, []);
    }
    this.historyByUser.get(record.userId)!.unshift(record.id);

    // Track index
    if (!this.historyByTrack.has(record.trackId)) {
      this.historyByTrack.set(record.trackId, []);
    }
    this.historyByTrack.get(record.trackId)!.unshift(record.id);

    if (persist) this.saveToDisk();
    return record;
  }

  public getHistoryForTrack(trackId: string): PlayHistoryEntity[] {
    const ids = this.historyByTrack.get(trackId) || [];
    return ids.map((id) => this.playHistory.get(id)!).filter(Boolean);
  }

  public getHistoryForUser(userId: string, limit = 50): PlayHistoryEntity[] {
    const ids = (this.historyByUser.get(userId) || []).slice(0, limit);
    return ids.map((id) => this.playHistory.get(id)!).filter(Boolean);
  }

  // --- Queues Table Operations ---
  public upsertQueue(queue: QueueEntity): QueueEntity {
    this.queues.set(queue.userId, queue);
    this.saveToDisk();
    return queue;
  }

  public findQueueByUserId(userId: string): QueueEntity | undefined {
    return this.queues.get(userId);
  }

  // --- Database Stats ---
  public getStats() {
    return {
      tables: {
        users: { rowCount: this.users.size, primaryKey: 'id', indexes: ['idx_users_email', 'idx_users_role'] },
        tracks: { rowCount: this.tracks.size, primaryKey: 'id', indexes: ['idx_tracks_genre', 'idx_tracks_artist', 'idx_tracks_play_count'] },
        playlists: { rowCount: this.playlists.size, primaryKey: 'id', indexes: ['idx_playlists_user_id', 'idx_playlists_updated_at'] },
        play_history: { rowCount: this.playHistory.size, primaryKey: 'id', indexes: ['idx_play_history_user', 'idx_play_history_track', 'idx_play_history_telemetry'] },
        queues: { rowCount: this.queues.size, primaryKey: 'id', indexes: ['idx_queues_user_id'] }
      },
      engine: 'High-Speed Relational Engine (PostgreSQL Compatible)',
      diskStorage: DB_STORE_FILE,
      totalRows: this.users.size + this.tracks.size + this.playlists.size + this.playHistory.size + this.queues.size
    };
  }
}

export const db = new DatabaseEngine();
