import { Track, Playlist } from '../types';

export interface SyncStatus {
  connected: boolean;
  status: 'connected' | 'connecting' | 'offline';
  lastSyncedAt: number;
  activeDevicesCount: number;
  devices: Array<{
    deviceId: string;
    deviceName: string;
    platform: string;
    lastActiveAt: number;
  }>;
}

export interface AlgorithmicBreakdown {
  recencyScore: number;
  frequencyScore: number;
  contextScore: number;
  totalScore: number;
  lastPlayedDaysAgo: number | null;
  loopCount: number;
  playCount: number;
  matchedHabits: string[];
  reasonBadge: string;
}

export interface QuickPickEnrichedTrack extends Track {
  algorithmBreakdown?: AlgorithmicBreakdown;
}

export interface QuickPicksApiResult {
  status: string;
  userId: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  clientHour: number;
  metrics: {
    totalEventsAnalyzed: number;
    sevenDayPlaysCount: number;
    highestLoopCount: number;
    contextVibe: string;
  };
  quickPicks: QuickPickEnrichedTrack[];
}

export interface LikeSyncEvent {
  trackId: string;
  isLiked: boolean;
  sourceDeviceId?: string;
  sourceDeviceName?: string;
}

export interface QueueSyncEvent {
  currentTrackId: string | null;
  currentTrack?: any;
  queueTrackIds: string[];
  queueTracks?: any[];
  queue?: any[];
  isPlaying: boolean;
  sourceDeviceId?: string;
  sourceDeviceName?: string;
}

export interface PlaylistsSyncEvent {
  playlists: Playlist[];
  playlist?: Playlist;
  sourceDeviceId?: string;
  sourceDeviceName?: string;
}

type LikeListener = (data: LikeSyncEvent) => void;
type QueueListener = (data: QueueSyncEvent) => void;
type PlaylistsListener = (data: PlaylistsSyncEvent) => void;
type StatusListener = (status: SyncStatus) => void;

class RealtimeSyncService {
  private eventSource: EventSource | null = null;
  private userId = 'default_user';
  private deviceId: string;
  private deviceName: string;
  private status: SyncStatus = {
    connected: false,
    status: 'offline',
    lastSyncedAt: 0,
    activeDevicesCount: 1,
    devices: []
  };

  private likeListeners: Set<LikeListener> = new Set();
  private queueListeners: Set<QueueListener> = new Set();
  private playlistsListeners: Set<PlaylistsListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private reconnectTimer: any = null;

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.deviceName = this.detectDeviceName();
    this.userId = this.getStoredUserId();
  }

  private getOrCreateDeviceId(): string {
    try {
      let id = localStorage.getItem('vd_device_id');
      if (!id) {
        id = `dev-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
        localStorage.setItem('vd_device_id', id);
      }
      return id;
    } catch {
      return `dev-${Math.random().toString(36).substring(2, 9)}`;
    }
  }

  private detectDeviceName(): string {
    if (typeof window === 'undefined') return 'Streamzy Client';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      return /Android/i.test(navigator.userAgent) ? 'Android Mobile Device' : 'iOS Mobile Device';
    }
    return 'Desktop Web Client';
  }

  private getStoredUserId(): string {
    try {
      return localStorage.getItem('vd_sync_user_id') || 'default_user';
    } catch {
      return 'default_user';
    }
  }

  public setUserId(userId: string) {
    this.userId = userId;
    try {
      localStorage.setItem('vd_sync_user_id', userId);
    } catch {}
    this.reconnect();
  }

  public getUserId(): string {
    return this.userId;
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public getDeviceName(): string {
    return this.deviceName;
  }

  public getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * Connect to server SSE real-time sync stream
   */
  public connect() {
    if (typeof window === 'undefined') return;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.updateStatus({ status: 'connecting', connected: false });

    try {
      const url = `/api/sync/stream?userId=${encodeURIComponent(this.userId)}&deviceId=${encodeURIComponent(this.deviceId)}&deviceName=${encodeURIComponent(this.deviceName)}`;
      const es = new EventSource(url);
      this.eventSource = es;

      es.onopen = () => {
        this.updateStatus({ status: 'connected', connected: true, lastSyncedAt: Date.now() });
      };

      es.addEventListener('initial_state', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.account) {
            this.handleInitialState(data.account);
          }
        } catch (err) {
          console.error('[RealtimeSync] Error parsing initial state:', err);
        }
      });

      es.addEventListener('like_updated', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const { trackId, isLiked } = data.payload || {};
          const sourceDeviceId = data.sourceDeviceId;
          const sourceDev = this.status.devices.find((d) => d.deviceId === sourceDeviceId);
          const sourceDeviceName = sourceDev?.deviceName || (sourceDeviceId === this.deviceId ? this.deviceName : 'Mobile Phone');
          
          this.likeListeners.forEach((cb) => cb({ trackId, isLiked, sourceDeviceId, sourceDeviceName }));
          this.updateStatus({ lastSyncedAt: Date.now() });
        } catch (err) {
          console.error('[RealtimeSync] Error parsing like_updated event:', err);
        }
      });

      es.addEventListener('queue_updated', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const queueData = data.payload || {};
          const sourceDeviceId = data.sourceDeviceId;
          const sourceDev = this.status.devices.find((d) => d.deviceId === sourceDeviceId);
          const sourceDeviceName = sourceDev?.deviceName || 'Mobile Phone';
          const queue = queueData.queueTracks || queueData.queue || [];

          this.queueListeners.forEach((cb) =>
            cb({
              ...queueData,
              queue,
              queueTracks: queue,
              sourceDeviceId,
              sourceDeviceName
            })
          );
          this.updateStatus({ lastSyncedAt: Date.now() });
        } catch (err) {
          console.error('[RealtimeSync] Error parsing queue_updated event:', err);
        }
      });

      es.addEventListener('playlists_updated', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const playlists = data.payload || [];
          const sourceDeviceId = data.sourceDeviceId;
          const sourceDev = this.status.devices.find((d) => d.deviceId === sourceDeviceId);
          const sourceDeviceName = sourceDev?.deviceName || 'Mobile Device';

          this.playlistsListeners.forEach((cb) =>
            cb({
              playlists,
              playlist: playlists[0],
              sourceDeviceId,
              sourceDeviceName
            })
          );
          this.updateStatus({ lastSyncedAt: Date.now() });
        } catch (err) {
          console.error('[RealtimeSync] Error parsing playlists_updated event:', err);
        }
      });

      es.addEventListener('device_joined', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.payload?.devices) {
            this.updateStatus({
              devices: data.payload.devices,
              activeDevicesCount: data.payload.devices.length
            });
          }
        } catch {}
      });

      es.onerror = () => {
        this.updateStatus({ status: 'offline', connected: false });
        es.close();
        this.eventSource = null;

        // Schedule auto-reconnect with 4s backoff
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, 4000);
      };
    } catch (err) {
      console.warn('[RealtimeSync] SSE connection setup failed:', err);
      this.updateStatus({ status: 'offline', connected: false });
    }
  }

  public disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.updateStatus({ status: 'offline', connected: false });
  }

  public reconnect() {
    this.disconnect();
    this.connect();
  }

  private handleInitialState(account: any) {
    if (account.devices) {
      this.updateStatus({
        devices: account.devices,
        activeDevicesCount: account.devices.length,
        lastSyncedAt: account.lastSyncedAt || Date.now()
      });
    }
  }

  private updateStatus(partial: Partial<SyncStatus>) {
    this.status = { ...this.status, ...partial };
    this.statusListeners.forEach((cb) => cb(this.status));
  }

  /**
   * Broadcast an instant like toggle to backend database and all connected devices
   */
  public async syncLike(trackId: string, isLiked: boolean): Promise<boolean> {
    try {
      const res = await fetch('/api/sync/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          deviceId: this.deviceId,
          type: 'LIKE_TRACK',
          payload: { trackId, isLiked }
        })
      });
      return res.ok;
    } catch (err) {
      console.warn('[RealtimeSync] Failed to sync like action:', err);
      return false;
    }
  }

  /**
   * Sync Up Next queue & playback position to account database
   */
  public async syncQueue(
    currentTrack: Track | null,
    queue: Track[],
    isPlaying: boolean,
    progressSec = 0
  ): Promise<boolean> {
    try {
      const res = await fetch('/api/sync/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          deviceId: this.deviceId,
          type: 'UPDATE_QUEUE',
          payload: {
            currentTrackId: currentTrack ? currentTrack.id : null,
            currentTrack,
            queueTrackIds: queue.map((t) => t.id),
            queueTracks: queue.slice(0, 20), // serialize top 20 items
            isPlaying,
            progressSec
          }
        })
      });
      return res.ok;
    } catch (err) {
      console.warn('[RealtimeSync] Failed to sync queue:', err);
      return false;
    }
  }

  /**
   * Sync user Playlists to backend database
   */
  public async syncPlaylists(playlists: Playlist[]): Promise<boolean> {
    try {
      const res = await fetch('/api/sync/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          deviceId: this.deviceId,
          type: 'UPDATE_PLAYLISTS',
          payload: { playlists }
        })
      });
      return res.ok;
    } catch (err) {
      console.warn('[RealtimeSync] Failed to sync playlists:', err);
      return false;
    }
  }

  /**
   * Sync single playlist creation or modification to cloud
   */
  public async syncPlaylist(playlist: Playlist): Promise<boolean> {
    try {
      const account = await this.fetchAccountState();
      const currentList: Playlist[] = account?.playlists || [];
      const filtered = currentList.filter((p) => p.id !== playlist.id);
      return await this.syncPlaylists([playlist, ...filtered]);
    } catch {
      return false;
    }
  }

  /**
   * Delete playlist on cloud database
   */
  public async syncDeletePlaylist(playlistId: string): Promise<boolean> {
    try {
      const account = await this.fetchAccountState();
      const currentList: Playlist[] = account?.playlists || [];
      const filtered = currentList.filter((p) => p.id !== playlistId);
      return await this.syncPlaylists(filtered);
    } catch {
      return false;
    }
  }

  /**
   * Record timestamped playback event to backend database for 7-day recency & loop frequency calculation
   */
  public async recordPlayback(
    trackId: string,
    loopCount = 0,
    durationSec = 180,
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night'
  ): Promise<boolean> {
    try {
      const res = await fetch('/api/sync/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          deviceId: this.deviceId,
          type: 'RECORD_PLAY',
          payload: { trackId, loopCount, durationSec, timeOfDay }
        })
      });
      return res.ok;
    } catch (err) {
      console.warn('[RealtimeSync] Failed to record playback event:', err);
      return false;
    }
  }

  /**
   * Fetch Quick Picks from the algorithmic endpoint
   */
  public async fetchQuickPicks(
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night',
    clientHour?: number,
    limit = 16
  ): Promise<QuickPicksApiResult | null> {
    try {
      const params = new URLSearchParams();
      params.append('userId', this.userId);
      if (timeOfDay) params.append('timeOfDay', timeOfDay);
      if (typeof clientHour === 'number') params.append('clientHour', clientHour.toString());
      if (limit) params.append('limit', limit.toString());

      const res = await fetch(`/api/quick-picks?${params.toString()}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[RealtimeSync] Failed to fetch quick picks from server:', err);
      return null;
    }
  }

  /**
   * Fetch current account database snapshot
   */
  public async fetchAccountState(): Promise<any> {
    try {
      const res = await fetch(`/api/sync/state?userId=${encodeURIComponent(this.userId)}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      return data.account;
    } catch (err) {
      console.warn('[RealtimeSync] Failed to fetch account state:', err);
      return null;
    }
  }

  /**
   * Test tool: Simulates an action coming from a secondary phone device (e.g. Pixel 8 Pro)
   * to showcase real-time multi-device synchronization instantly.
   */
  public async simulatePhoneAction(
    actionType: 'LIKE_TRACK' | 'UPDATE_QUEUE' | 'LIKE_RANDOM',
    trackId?: string,
    isLiked?: boolean
  ): Promise<any> {
    try {
      const res = await fetch('/api/sync/simulate-phone-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          actionType,
          trackId,
          isLiked
        })
      });
      return await res.json();
    } catch (err) {
      console.error('[RealtimeSync] Simulation failed:', err);
      return null;
    }
  }

  // Listener subscriptions
  public onLikeUpdated(cb: LikeListener): () => void {
    this.likeListeners.add(cb);
    return () => this.likeListeners.delete(cb);
  }

  public onQueueUpdated(cb: QueueListener): () => void {
    this.queueListeners.add(cb);
    return () => this.queueListeners.delete(cb);
  }

  public onPlaylistsUpdated(cb: PlaylistsListener): () => void {
    this.playlistsListeners.add(cb);
    return () => this.playlistsListeners.delete(cb);
  }

  public onPlaylistUpdated(cb: PlaylistsListener): () => void {
    return this.onPlaylistsUpdated(cb);
  }

  public onStatusChanged(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }
}

export const realtimeSyncService = new RealtimeSyncService();
