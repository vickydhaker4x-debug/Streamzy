import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { Track } from '../types';

export interface NativeTrackPayload {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  videoId?: string;
  audioUrl?: string;
  streamUrl?: string;
  durationSec: number;
  isFavorite?: boolean;
}

export interface NativePlaybackState {
  isPlaying: boolean;
  currentTrack: NativeTrackPayload | null;
  positionSec: number;
  durationSec: number;
  currentIndex: number;
  repeatMode: 'off' | 'all' | 'one';
  isShuffle: boolean;
}

export interface NativeAudioPlayerPluginInterface {
  isNativePlaybackAvailable(): Promise<{ available: boolean; platform: string }>;
  play(options: {
    track: NativeTrackPayload;
    streamUrl?: string;
    queue?: NativeTrackPayload[];
    currentIndex?: number;
    repeatMode?: string;
    isShuffle?: boolean;
    mimeType?: string;
  }): Promise<{ success: boolean }>;
  pause(): Promise<{ success: boolean }>;
  resume(): Promise<{ success: boolean }>;
  stop(): Promise<{ success: boolean }>;
  next(): Promise<{ success: boolean }>;
  previous(): Promise<{ success: boolean }>;
  seek(options: { positionSec: number }): Promise<{ success: boolean }>;
  loadTrack(options: { track: NativeTrackPayload; streamUrl?: string }): Promise<{ success: boolean }>;
  setQueue(options: {
    queue: NativeTrackPayload[];
    currentIndex: number;
    repeatMode: string;
    isShuffle: boolean;
  }): Promise<{ success: boolean }>;
  setRepeatMode(options: { repeatMode: string }): Promise<{ success: boolean }>;
  setShuffleMode(options: { isShuffle: boolean }): Promise<{ success: boolean }>;
  updateMetadata(options: { track: NativeTrackPayload; isFavorite?: boolean }): Promise<{ success: boolean }>;
  getPlaybackState(): Promise<NativePlaybackState>;
  addListener(eventName: string, listenerFunc: (data: any) => void): Promise<PluginListenerHandle>;
}

// Register native plugin
const NativeAudioPlayer = registerPlugin<NativeAudioPlayerPluginInterface>('NativeAudioPlayer');

type PlaybackEventHandler = {
  onTimeUpdate?: (positionSec: number, durationSec: number) => void;
  onTrackChanged?: (track: NativeTrackPayload, currentIndex: number) => void;
  onStateChanged?: (isPlaying: boolean) => void;
  onEnded?: (track: NativeTrackPayload | null) => void;
  onError?: (error: string) => void;
};

class NativeAudioPlayerService {
  private isAndroid: boolean = false;
  private isAvailable: boolean = false;
  private eventHandlers: Set<PlaybackEventHandler> = new Set();
  private isInitialized: boolean = false;
  private lastKnownState: NativePlaybackState | null = null;

  constructor() {
    this.checkPlatform();
  }

  private checkPlatform() {
    if (typeof window !== 'undefined') {
      this.isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
      if (this.isAndroid) {
        this.initBridgeListeners();
      }
    }
  }

  public isNative(): boolean {
    return this.isAndroid;
  }

  public async initialize(): Promise<boolean> {
    if (!this.isAndroid) return false;
    if (this.isInitialized) return this.isAvailable;

    try {
      const res = await NativeAudioPlayer.isNativePlaybackAvailable();
      this.isAvailable = Boolean(res?.available);
      this.isInitialized = true;
      console.log('[NativeAudioPlayer] Native playback available on Android:', this.isAvailable);
      return this.isAvailable;
    } catch (e) {
      console.warn('[NativeAudioPlayer] Native bridge initialization note:', e);
      this.isAvailable = false;
      return false;
    }
  }

  private initBridgeListeners() {
    if (!this.isAndroid) return;

    try {
      NativeAudioPlayer.addListener('PLAYBACK_STARTED', (data) => {
        console.log('[NativeAudioPlayer] Event: PLAYBACK_STARTED', data);
        if (this.lastKnownState) this.lastKnownState.isPlaying = true;
        this.eventHandlers.forEach((h) => h.onStateChanged?.(true));
      });

      NativeAudioPlayer.addListener('PLAYBACK_PAUSED', (data) => {
        console.log('[NativeAudioPlayer] Event: PLAYBACK_PAUSED', data);
        if (this.lastKnownState) this.lastKnownState.isPlaying = false;
        this.eventHandlers.forEach((h) => h.onStateChanged?.(false));
      });

      NativeAudioPlayer.addListener('PLAYBACK_STOPPED', () => {
        console.log('[NativeAudioPlayer] Event: PLAYBACK_STOPPED');
        if (this.lastKnownState) this.lastKnownState.isPlaying = false;
        this.eventHandlers.forEach((h) => h.onStateChanged?.(false));
      });

      NativeAudioPlayer.addListener('TRACK_CHANGED', (data) => {
        console.log('[NativeAudioPlayer] Event: TRACK_CHANGED', data);
        if (data?.track) {
          this.eventHandlers.forEach((h) => h.onTrackChanged?.(data.track, data.currentIndex || 0));
        }
      });

      NativeAudioPlayer.addListener('PLAYBACK_POSITION', (data) => {
        if (data && typeof data.positionSec === 'number') {
          this.eventHandlers.forEach((h) => h.onTimeUpdate?.(data.positionSec, data.durationSec || 0));
        }
      });

      NativeAudioPlayer.addListener('PLAYBACK_COMPLETED', (data) => {
        console.log('[NativeAudioPlayer] Event: PLAYBACK_COMPLETED', data);
        this.eventHandlers.forEach((h) => h.onEnded?.(data?.track || null));
      });

      NativeAudioPlayer.addListener('PLAYBACK_ERROR', (data) => {
        console.warn('[NativeAudioPlayer] Event: PLAYBACK_ERROR', data);
        this.eventHandlers.forEach((h) => h.onError?.(data?.message || 'Playback error'));
      });
    } catch (err) {
      console.warn('[NativeAudioPlayer] Error binding plugin listeners:', err);
    }
  }

  public registerHandler(handler: PlaybackEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  public trackToNativePayload(track: Track, streamUrl?: string): NativeTrackPayload {
    return {
      id: track.id,
      title: track.title,
      artist: track.artist || 'Unknown Artist',
      album: track.album || 'Streamzy',
      coverUrl: track.coverUrl || '',
      videoId: track.videoId || '',
      audioUrl: track.audioUrl || '',
      streamUrl: streamUrl || track.streamUrl || track.audioUrl || '',
      durationSec: track.durationSec || 0,
      isFavorite: Boolean(track.isFavorite)
    };
  }

  public async play(
    track: Track,
    streamUrl?: string,
    queue: Track[] = [],
    currentIndex = 0,
    repeatMode: 'off' | 'all' | 'one' = 'all',
    isShuffle = false,
    mimeType = ''
  ): Promise<boolean> {
    if (!this.isAndroid) return false;

    try {
      const nativeTrack = this.trackToNativePayload(track, streamUrl);
      const nativeQueue = queue.map((t) => this.trackToNativePayload(t));

      await NativeAudioPlayer.play({
        track: nativeTrack,
        streamUrl,
        queue: nativeQueue,
        currentIndex,
        repeatMode,
        isShuffle,
        mimeType
      });
      return true;
    } catch (e) {
      console.error('[NativeAudioPlayer] play failed:', e);
      return false;
    }
  }

  public async pause(): Promise<boolean> {
    if (!this.isAndroid) return false;
    try {
      await NativeAudioPlayer.pause();
      return true;
    } catch (e) {
      console.error('[NativeAudioPlayer] pause failed:', e);
      return false;
    }
  }

  public async resume(): Promise<boolean> {
    if (!this.isAndroid) return false;
    try {
      await NativeAudioPlayer.resume();
      return true;
    } catch (e) {
      console.error('[NativeAudioPlayer] resume failed:', e);
      return false;
    }
  }

  public async stop(): Promise<boolean> {
    if (!this.isAndroid) return false;
    try {
      await NativeAudioPlayer.stop();
      return true;
    } catch (e) {
      console.error('[NativeAudioPlayer] stop failed:', e);
      return false;
    }
  }

  public async next(): Promise<boolean> {
    if (!this.isAndroid) return false;
    try {
      await NativeAudioPlayer.next();
      return true;
    } catch (e) {
      console.error('[NativeAudioPlayer] next failed:', e);
      return false;
    }
  }

  public async previous(): Promise<boolean> {
    if (!this.isAndroid) return false;
    try {
      await NativeAudioPlayer.previous();
      return true;
    } catch (e) {
      console.error('[NativeAudioPlayer] previous failed:', e);
      return false;
    }
  }

  public async seek(positionSec: number): Promise<boolean> {
    if (!this.isAndroid) return false;
    try {
      await NativeAudioPlayer.seek({ positionSec });
      return true;
    } catch (e) {
      console.error('[NativeAudioPlayer] seek failed:', e);
      return false;
    }
  }

  public async setQueue(
    queue: Track[],
    currentIndex = 0,
    repeatMode: 'off' | 'all' | 'one' = 'all',
    isShuffle = false
  ): Promise<boolean> {
    if (!this.isAndroid) return false;
    try {
      const nativeQueue = queue.map((t) => this.trackToNativePayload(t));
      await NativeAudioPlayer.setQueue({
        queue: nativeQueue,
        currentIndex,
        repeatMode,
        isShuffle
      });
      return true;
    } catch (e) {
      console.error('[NativeAudioPlayer] setQueue failed:', e);
      return false;
    }
  }

  public async setRepeatMode(repeatMode: 'off' | 'all' | 'one'): Promise<boolean> {
    if (!this.isAndroid) return false;
    try {
      await NativeAudioPlayer.setRepeatMode({ repeatMode });
      return true;
    } catch (e) {
      console.error('[NativeAudioPlayer] setRepeatMode failed:', e);
      return false;
    }
  }

  public async setShuffleMode(isShuffle: boolean): Promise<boolean> {
    if (!this.isAndroid) return false;
    try {
      await NativeAudioPlayer.setShuffleMode({ isShuffle });
      return true;
    } catch (e) {
      console.error('[NativeAudioPlayer] setShuffleMode failed:', e);
      return false;
    }
  }

  public async updateMetadata(track: Track, isFavorite = false): Promise<boolean> {
    if (!this.isAndroid) return false;
    try {
      const nativeTrack = this.trackToNativePayload(track);
      await NativeAudioPlayer.updateMetadata({ track: nativeTrack, isFavorite });
      return true;
    } catch (e) {
      console.error('[NativeAudioPlayer] updateMetadata failed:', e);
      return false;
    }
  }

  public async getPlaybackState(): Promise<NativePlaybackState | null> {
    if (!this.isAndroid) return null;
    try {
      const state = await NativeAudioPlayer.getPlaybackState();
      this.lastKnownState = state;
      return state;
    } catch (e) {
      console.error('[NativeAudioPlayer] getPlaybackState failed:', e);
      return null;
    }
  }
}

export const nativeAudioPlayerService = new NativeAudioPlayerService();
