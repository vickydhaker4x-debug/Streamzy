import { Track } from '../types';

export interface MediaSessionCallbacks {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onSeek?: (seconds: number) => void;
  onToggleFavorite?: (trackId: string) => void;
}

class MediaSessionService {
  private currentTrack: Track | null = null;
  private isPlaying: boolean = false;
  private callbacks: MediaSessionCallbacks | null = null;
  private isSupported: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      this.isSupported = true;
    }
  }

  public registerCallbacks(callbacks: Partial<MediaSessionCallbacks>) {
    this.callbacks = { ...(this.callbacks || {}), ...callbacks };
    if (this.isSupported) {
      this.setupMediaSessionActionHandlers();
    }
  }

  private setupMediaSessionActionHandlers() {
    if (!this.isSupported || !('mediaSession' in navigator)) return;

    const ms = navigator.mediaSession;

    const safeSetActionHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch (e) {
        // Some browsers don't support all action types
      }
    };

    safeSetActionHandler('play', () => {
      if (this.callbacks?.onPlay) {
        this.callbacks.onPlay();
        this.setPlaybackState('playing');
      }
    });

    safeSetActionHandler('pause', () => {
      if (this.callbacks?.onPause) {
        this.callbacks.onPause();
        this.setPlaybackState('paused');
      }
    });

    safeSetActionHandler('previoustrack', () => {
      if (this.callbacks?.onPrevious) {
        this.callbacks.onPrevious();
      }
    });

    safeSetActionHandler('nexttrack', () => {
      if (this.callbacks?.onNext) {
        this.callbacks.onNext();
      }
    });

    safeSetActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && this.callbacks?.onSeek) {
        this.callbacks.onSeek(details.seekTime);
      }
    });

    safeSetActionHandler('seekbackward', (details) => {
      const skipTime = details.seekOffset || 10;
      if (this.callbacks?.onSeek && this.currentTrack) {
        // Will be updated via caller
      }
    });

    safeSetActionHandler('seekforward', (details) => {
      const skipTime = details.seekOffset || 10;
      if (this.callbacks?.onSeek && this.currentTrack) {
        // Will be updated via caller
      }
    });

    safeSetActionHandler('stop', () => {
      if (this.callbacks?.onPause) {
        this.callbacks.onPause();
        this.setPlaybackState('none');
      }
    });
  }

  /**
   * Update Lockscreen & OS Notification metadata
   */
  public updateMetadata(track: Track, isFavorite: boolean = false) {
    this.currentTrack = track;
    if (!this.isSupported || !('mediaSession' in navigator) || !track) return;

    try {
      const coverUrl = track.coverUrl.startsWith('http')
        ? track.coverUrl
        : `${window.location.origin}${track.coverUrl.startsWith('/') ? '' : '/'}${track.coverUrl}`;

      const artwork = [
        { src: coverUrl, sizes: '96x96', type: 'image/jpeg' },
        { src: coverUrl, sizes: '128x128', type: 'image/jpeg' },
        { src: coverUrl, sizes: '192x192', type: 'image/jpeg' },
        { src: coverUrl, sizes: '256x256', type: 'image/jpeg' },
        { src: coverUrl, sizes: '384x384', type: 'image/jpeg' },
        { src: coverUrl, sizes: '512x512', type: 'image/jpeg' }
      ];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'Streamzy',
        artwork
      });
    } catch (e) {
      console.warn('[MediaSession] Metadata update error', e);
    }
  }

  /**
   * Update favorite status dynamically on active metadata
   */
  public updateFavoriteState(isFavorite: boolean) {
    if (this.currentTrack) {
      this.currentTrack = { ...this.currentTrack, isFavorite };
      this.updateMetadata(this.currentTrack, isFavorite);
    }
  }

  /**
   * Update Lockscreen Playback State (playing / paused)
   */
  public setPlaybackState(state: 'playing' | 'paused' | 'none') {
    this.isPlaying = state === 'playing';
    if (!this.isSupported || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.playbackState = state;
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Sync Position State with Lockscreen Progress Bar (Scrubber)
   */
  public setPositionState(positionSec: number, durationSec: number, playbackRate: number = 1.0) {
    if (!this.isSupported || !('mediaSession' in navigator)) return;
    if (typeof navigator.mediaSession.setPositionState !== 'function') return;

    try {
      if (durationSec > 0 && positionSec >= 0 && positionSec <= durationSec) {
        navigator.mediaSession.setPositionState({
          duration: durationSec,
          playbackRate,
          position: positionSec
        });
      }
    } catch (e) {
      // Out of bounds or unsupported
    }
  }

  public getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const mediaSessionService = new MediaSessionService();
