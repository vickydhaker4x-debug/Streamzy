import fs from 'fs';
import path from 'path';

export interface PlaybackEvent {
  trackId: string;
  timestamp: number; // ms
  durationSec?: number;
  loopCount?: number;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  hour?: number;
  deviceId?: string;
}

export interface UserAccountData {
  userId: string;
  userName: string;
  likedTrackIds: string[];
  playlists: Array<{
    id: string;
    name: string;
    description?: string;
    createdAt: number;
    updatedAt: number;
    trackIds: string[];
    coverUrl?: string;
  }>;
  upNextQueue: {
    currentTrackId: string | null;
    currentTrack?: any;
    queueTrackIds: string[];
    queueTracks?: any[];
    isPlaying: boolean;
    progressSec: number;
    updatedAt: number;
    updatedByDeviceId?: string;
  };
  library: {
    savedAlbumIds: string[];
    savedArtistIds: string[];
    customTrackIds: string[];
  };
  playbackEvents: PlaybackEvent[];
  devices: Array<{
    deviceId: string;
    deviceName: string;
    lastActiveAt: number;
    platform: 'mobile' | 'desktop' | 'tablet' | 'web';
  }>;
  lastSyncedAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const DB_FILE = path.join(DATA_DIR, 'account_database.json');

class AccountDatabase {
  private accounts: Map<string, UserAccountData> = new Map();
  private subscribers: Map<string, Set<(event: { type: string; payload: any; sourceDeviceId?: string }) => void>> = new Map();

  constructor() {
    this.ensureDataDir();
    this.loadFromDisk();
    this.seedDefaultUserIfEmpty();
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (err) {
      console.warn('[AccountDatabase] Could not create data dir:', err);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          data.forEach((acc: UserAccountData) => {
            this.accounts.set(acc.userId, acc);
          });
          console.log(`[AccountDatabase] Loaded ${this.accounts.size} account(s) from persistent disk.`);
        }
      }
    } catch (err) {
      console.warn('[AccountDatabase] Failed to read database from disk, using in-memory store:', err);
    }
  }

  private saveToDisk() {
    try {
      const data = Array.from(this.accounts.values());
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[AccountDatabase] Failed to persist database to disk:', err);
    }
  }

  private seedDefaultUserIfEmpty() {
    const defaultUserId = 'default_user';
    if (!this.accounts.has(defaultUserId)) {
      const now = Date.now();
      const oneHour = 3600 * 1000;
      const oneDay = 24 * oneHour;

      // Seed with initial realistic 7-day playback events to demonstrate recency, frequency and time-of-day habits
      const initialEvents: PlaybackEvent[] = [
        // Morning events (7:00 AM - 10:00 AM) in the last 7 days
        { trackId: 'track-sauda-iss-dil-ka', timestamp: now - 3 * oneHour, loopCount: 3, timeOfDay: 'morning', hour: 8, deviceId: 'phone-android' },
        { trackId: 'track-lofi-lovee', timestamp: now - 18 * oneHour, loopCount: 2, timeOfDay: 'night', hour: 23, deviceId: 'phone-android' },
        { trackId: 'track-preet-re', timestamp: now - 1 * oneDay, loopCount: 4, timeOfDay: 'evening', hour: 19, deviceId: 'web-browser' },
        { trackId: 'track-kinna-sohna', timestamp: now - 2 * oneDay, loopCount: 1, timeOfDay: 'morning', hour: 9, deviceId: 'phone-android' },
        { trackId: 'track-kesariya', timestamp: now - 3 * oneDay, loopCount: 5, timeOfDay: 'morning', hour: 7, deviceId: 'phone-android' },
        { trackId: 'track-chaleya', timestamp: now - 4 * oneDay, loopCount: 2, timeOfDay: 'afternoon', hour: 14, deviceId: 'web-browser' },
        { trackId: 'track-295', timestamp: now - 5 * oneDay, loopCount: 6, timeOfDay: 'afternoon', hour: 16, deviceId: 'phone-android' },
        { trackId: 'track-brown-munde', timestamp: now - 6 * oneDay, loopCount: 3, timeOfDay: 'evening', hour: 20, deviceId: 'phone-android' },
        { trackId: 'track-starboy', timestamp: now - 2 * oneDay, loopCount: 4, timeOfDay: 'night', hour: 22, deviceId: 'web-browser' },
        { trackId: 'track-softly', timestamp: now - 8 * oneHour, loopCount: 2, timeOfDay: 'afternoon', hour: 15, deviceId: 'phone-android' },
      ];

      const defaultAccount: UserAccountData = {
        userId: defaultUserId,
        userName: 'Music Enthusiast',
        likedTrackIds: [
          'track-sauda-iss-dil-ka',
          'track-preet-re',
          'track-kesariya',
          'track-starboy'
        ],
        playlists: [
          {
            id: 'pl-favorites-vibe',
            name: 'Daily Melodic Heavy Rotation',
            description: 'Continuously synced cloud playlist featuring heavy repeats & morning favorites',
            createdAt: now - 5 * oneDay,
            updatedAt: now - 2 * oneHour,
            trackIds: ['track-sauda-iss-dil-ka', 'track-preet-re', 'track-kesariya', 'track-chaleya']
          },
          {
            id: 'pl-night-chill',
            name: 'Midnight Chillout & Lo-Fi',
            description: 'Late night soothing tunes and lo-fi melodies',
            createdAt: now - 10 * oneDay,
            updatedAt: now - 18 * oneHour,
            trackIds: ['track-lofi-lovee', 'track-kinna-sohna', 'track-starboy']
          }
        ],
        upNextQueue: {
          currentTrackId: 'track-sauda-iss-dil-ka',
          queueTrackIds: ['track-preet-re', 'track-lofi-lovee', 'track-kinna-sohna'],
          isPlaying: false,
          progressSec: 0,
          updatedAt: now,
          updatedByDeviceId: 'phone-android'
        },
        library: {
          savedAlbumIds: ['alb-sharma ji ki shaadi', 'alb-dhadak 2'],
          savedArtistIds: ['Arijit Singh', 'Darshan Raval'],
          customTrackIds: []
        },
        playbackEvents: initialEvents,
        devices: [
          {
            deviceId: 'phone-android',
            deviceName: 'Pixel 8 Pro (Mobile)',
            lastActiveAt: now - 10 * 60 * 1000,
            platform: 'mobile'
          },
          {
            deviceId: 'web-browser',
            deviceName: 'Chrome Web Client',
            lastActiveAt: now,
            platform: 'desktop'
          }
        ],
        lastSyncedAt: now
      };

      this.accounts.set(defaultUserId, defaultAccount);
      this.saveToDisk();
    }
  }

  public getAccount(userId = 'default_user'): UserAccountData {
    if (!this.accounts.has(userId)) {
      const now = Date.now();
      const newAccount: UserAccountData = {
        userId,
        userName: 'Music Enthusiast',
        likedTrackIds: [],
        playlists: [],
        upNextQueue: {
          currentTrackId: null,
          queueTrackIds: [],
          isPlaying: false,
          progressSec: 0,
          updatedAt: now
        },
        library: {
          savedAlbumIds: [],
          savedArtistIds: [],
          customTrackIds: []
        },
        playbackEvents: [],
        devices: [
          {
            deviceId: 'device-initial',
            deviceName: 'Client Device',
            lastActiveAt: now,
            platform: 'web'
          }
        ],
        lastSyncedAt: now
      };
      this.accounts.set(userId, newAccount);
      this.saveToDisk();
    }
    return this.accounts.get(userId)!;
  }

  public updateAccount(userId: string, updater: (acc: UserAccountData) => void, sourceDeviceId?: string, eventType = 'SYNC_UPDATE'): UserAccountData {
    const acc = this.getAccount(userId);
    updater(acc);
    acc.lastSyncedAt = Date.now();
    this.saveToDisk();

    // Notify connected SSE subscribers for this user
    this.broadcast(userId, {
      type: eventType,
      payload: acc,
      sourceDeviceId
    });

    return acc;
  }

  public likeTrack(userId: string, trackId: string, isLiked: boolean, deviceId?: string): { success: boolean; likedTrackIds: string[] } {
    const acc = this.getAccount(userId);
    const set = new Set(acc.likedTrackIds);
    if (isLiked) {
      set.add(trackId);
    } else {
      set.delete(trackId);
    }
    acc.likedTrackIds = Array.from(set);
    acc.lastSyncedAt = Date.now();

    if (deviceId) {
      this.touchDevice(acc, deviceId);
    }

    this.saveToDisk();

    this.broadcast(userId, {
      type: 'LIKE_UPDATED',
      payload: { trackId, isLiked, likedTrackIds: acc.likedTrackIds },
      sourceDeviceId: deviceId
    });

    return { success: true, likedTrackIds: acc.likedTrackIds };
  }

  public updateQueue(
    userId: string,
    queueData: {
      currentTrackId: string | null;
      currentTrack?: any;
      queueTrackIds: string[];
      queueTracks?: any[];
      isPlaying: boolean;
      progressSec?: number;
    },
    deviceId?: string
  ): UserAccountData {
    const acc = this.getAccount(userId);
    acc.upNextQueue = {
      ...acc.upNextQueue,
      currentTrackId: queueData.currentTrackId,
      currentTrack: queueData.currentTrack,
      queueTrackIds: queueData.queueTrackIds,
      queueTracks: queueData.queueTracks,
      isPlaying: Boolean(queueData.isPlaying),
      progressSec: queueData.progressSec || 0,
      updatedAt: Date.now(),
      updatedByDeviceId: deviceId
    };
    acc.lastSyncedAt = Date.now();

    if (deviceId) {
      this.touchDevice(acc, deviceId);
    }

    this.saveToDisk();

    this.broadcast(userId, {
      type: 'QUEUE_UPDATED',
      payload: acc.upNextQueue,
      sourceDeviceId: deviceId
    });

    return acc;
  }

  public updatePlaylists(userId: string, playlists: any[], deviceId?: string): UserAccountData {
    const acc = this.getAccount(userId);
    acc.playlists = playlists;
    acc.lastSyncedAt = Date.now();

    if (deviceId) {
      this.touchDevice(acc, deviceId);
    }

    this.saveToDisk();

    this.broadcast(userId, {
      type: 'PLAYLISTS_UPDATED',
      payload: acc.playlists,
      sourceDeviceId: deviceId
    });

    return acc;
  }

  public recordPlayback(
    userId: string,
    event: {
      trackId: string;
      loopCount?: number;
      durationSec?: number;
      timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
      deviceId?: string;
    }
  ): UserAccountData {
    const acc = this.getAccount(userId);
    const now = Date.now();
    const currentHour = new Date().getHours();

    const determinedTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' =
      event.timeOfDay ||
      (currentHour >= 5 && currentHour < 12
        ? 'morning'
        : currentHour >= 12 && currentHour < 17
        ? 'afternoon'
        : currentHour >= 17 && currentHour < 21
        ? 'evening'
        : 'night');

    const newEvent: PlaybackEvent = {
      trackId: event.trackId,
      timestamp: now,
      durationSec: event.durationSec || 180,
      loopCount: event.loopCount || 0,
      timeOfDay: determinedTimeOfDay,
      hour: currentHour,
      deviceId: event.deviceId
    };

    // Keep up to 500 recent playback events
    acc.playbackEvents.unshift(newEvent);
    if (acc.playbackEvents.length > 500) {
      acc.playbackEvents.pop();
    }
    acc.lastSyncedAt = now;

    if (event.deviceId) {
      this.touchDevice(acc, event.deviceId);
    }

    this.saveToDisk();

    this.broadcast(userId, {
      type: 'PLAYBACK_RECORDED',
      payload: newEvent,
      sourceDeviceId: event.deviceId
    });

    return acc;
  }

  public registerDevice(
    userId: string,
    deviceId: string,
    deviceName: string,
    platform: 'mobile' | 'desktop' | 'tablet' | 'web' = 'web'
  ): UserAccountData {
    const acc = this.getAccount(userId);
    const now = Date.now();
    const existing = acc.devices.find((d) => d.deviceId === deviceId);

    if (existing) {
      existing.deviceName = deviceName;
      existing.lastActiveAt = now;
      existing.platform = platform;
    } else {
      acc.devices.push({
        deviceId,
        deviceName,
        lastActiveAt: now,
        platform
      });
    }

    acc.lastSyncedAt = now;
    this.saveToDisk();

    this.broadcast(userId, {
      type: 'DEVICE_JOINED',
      payload: { devices: acc.devices, deviceId, deviceName },
      sourceDeviceId: deviceId
    });

    return acc;
  }

  private touchDevice(acc: UserAccountData, deviceId: string) {
    const dev = acc.devices.find((d) => d.deviceId === deviceId);
    if (dev) {
      dev.lastActiveAt = Date.now();
    }
  }

  public subscribe(userId: string, callback: (event: { type: string; payload: any; sourceDeviceId?: string }) => void): () => void {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set());
    }
    const set = this.subscribers.get(userId)!;
    set.add(callback);

    return () => {
      set.delete(callback);
    };
  }

  private broadcast(userId: string, event: { type: string; payload: any; sourceDeviceId?: string }) {
    const set = this.subscribers.get(userId);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.error('[AccountDatabase] Subscriber broadcast error:', err);
        }
      });
    }
  }
}

export const accountDatabase = new AccountDatabase();
