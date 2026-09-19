import { logPlaybackDiagnostics } from "./diagnosticLogger";
import { diagnosticService } from "../services/diagnosticService";
/**
 * Streamzy Centralized Universal Audio Engine
 * Production-ready resilient audio pipeline supporting:
 * 1. Intelligent Short-Lived Stream URL Management with TTL, Expiration & Blacklist checks
 * 2. Seamless Dual-Deck (Primary & Standby) Architecture with Zero-Latency Pre-buffering
 * 3. Safe Blob URL Lifecycle Management (Retain during play, safe revocation on change)
 * 4. Full HTML5 Audio Event Suite (loadedmetadata, canplay, waiting, stalled, error, ended, abort, emptied)
 * 5. Automatic Multi-Tier Fallback: Pre-buffered Blob -> Offline Decrypted Vault -> Direct Validated Stream -> Backend Range Stream -> YouTube IFrame
 * 6. Detailed Diagnostic Logging with [AudioEngine] prefix
 */

import { App } from '@capacitor/app';
import { Track } from '../types';
import { adaptiveBitrateService } from '../services/adaptiveBitrateService';
import { persistentBackgroundService } from '../services/persistentBackgroundService';
import { mediaSessionService } from '../services/mediaSessionService';
import { audioFocusService } from '../services/audioFocusService';
import { encryptedStorageService } from '../services/encryptedStorageService';
import { networkMonitorService } from '../services/networkMonitorService';
import { offlineService } from '../services/offlineService';
import { nativeAudioPlayerService } from '../services/nativeAudioPlayerService';
import { getAudioStreamInfo, StreamInfo } from './pipedApi';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export interface CachedStreamRecord {
  url: string;
  mimeType: string;
  obtainedAt: number;
  expiresAt: number;
  isBlob: boolean;
  sourceType: 'blob' | 'remote' | 'backend' | 'youtube';
}

export class AudioEngine {
  // Dual-Deck HTML5 Audio Pipeline
  private primaryAudio: HTMLAudioElement | null = null;
  private standbyAudio: HTMLAudioElement | null = null;

  // Active Playback State
  private currentActiveTrack: Track | null = null;
  private currentStreamRecord: CachedStreamRecord | null = null;
  private currentMode: 'audio' | 'youtube' | 'backend' = 'audio';
  private isPlaying: boolean = false;
  private volume: number = 1.0;
  private playRequestId: number = 0;
  private hasRetriedTrackId: string | null = null;

  // Stream URL Cache & Failure Tracking
  private streamUrlCache: Map<string, CachedStreamRecord> = new Map(); // trackId -> CachedStreamRecord
  private failedStreamUrls: Set<string> = new Set(); // Blacklisted invalid/failed URLs
  private activeBlobUrls: Map<string, string> = new Map(); // trackId -> blobUrl

  // Pre-buffering State
  private prebufferedTrack: Track | null = null;
  private prebufferedBlobUrl: string | null = null;
  private isNextPrebuffered: boolean = false;
  private activeQueue: Track[] = [];

  // YouTube IFrame Player (Fallback Deck)
  private ytPlayer: any = null;
  private isYtReady: boolean = false;
  private pendingVideoId: string | null = null;
  private ytInterval: number | null = null;
  private ytContainerId: string = 'vd-hidden-yt-player';

  // Playback & Feature Settings
  private volumeNormalization: boolean = true;
  private skipSilence: boolean = true;
  private skipSponsor: boolean = true;
  private audioQuality: string = '320kbps High-Res Audio';
  private streamingInstance: string = 'Direct YouTube Stream';
  private backgroundPlayback: boolean = true;

  // Background Audio & WakeLock Keep-Alive
  private silentAudio: HTMLAudioElement | null = null;
  private wakeLock: any = null;

  // Dynamic Segment Tracking & Silence Trimming
  private currentTrackDuration: number = 0;
  private sponsorSegments: { start: number; end: number }[] = [];
  private isInitialSilenceSkipped: boolean = false;

  // OS Integration & Audio Focus
  private audioFocusMultiplier: number = 1.0;
  private onNextTrackExternal: (() => void) | null = null;
  private onPrevTrackExternal: (() => void) | null = null;

  // UI Event Callbacks
  private onTimeUpdateCallback: ((timeSec: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;
  private onErrorCallback: ((err: string) => void) | null = null;

  // Native Android Playback Coordination
  private repeatMode: 'off' | 'all' | 'one' = 'all';
  private isShuffle: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      if (nativeAudioPlayerService.isNative()) {
        this.initNativePlayerBridge();
      }
      this.initAudioDecks();
      this.initSilentKeepAlive();
      this.initMediaSession();
      this.initAudioFocus();
      this.initAppLifecycle();
      this.initYouTubePlayer();
      this.initNetworkAutoSwitch();
    }
  }

  private initNativePlayerBridge() {
    nativeAudioPlayerService.initialize();
    nativeAudioPlayerService.registerHandler({
      onTimeUpdate: (sec) => {
        if (this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback(sec);
        }
      },
      onStateChanged: (playing) => {
        this.isPlaying = playing;
      },
      onTrackChanged: (trackPayload) => {
        if (trackPayload) {
          const matched = this.activeQueue.find((t) => t.id === trackPayload.id);
          this.currentActiveTrack = matched || (trackPayload as unknown as Track);
        }
      },
      onEnded: () => {
        if (this.onEndedCallback) {
          this.onEndedCallback();
        }
      },
      onError: async (err) => {
        console.warn('[AudioEngine] Native playback error detected:', err);
        const currentTrack = this.currentActiveTrack;
        if (currentTrack && this.hasRetriedTrackId !== currentTrack.id) {
          this.hasRetriedTrackId = currentTrack.id;
          console.log(`[AudioEngine] 🔄 Playback error detected for "${currentTrack.title}". Clearing cache and retrying ONCE with fresh resolved stream...`);
          
          // Clear cache for this song to force a new stream resolution
          this.streamUrlCache.delete(currentTrack.id);
          this.failedStreamUrls.add(this.currentStreamRecord?.url || '');
          
          // Re-trigger playback
          try {
            await this.play(
              currentTrack,
              this.onTimeUpdateCallback || undefined,
              this.onEndedCallback || undefined,
              this.onErrorCallback || undefined,
              this.activeQueue
            );
            return;
          } catch (retryErr) {
            console.error('[AudioEngine] Playback retry failed:', retryErr);
          }
        }

        if (this.onErrorCallback) {
          this.onErrorCallback(err);
        }
      }
    });
  }

  /**
   * Initialize dual primary and standby audio elements
   */
  private initAudioDecks() {
    this.primaryAudio = new Audio();
    this.primaryAudio.preload = 'auto';
    this.primaryAudio.setAttribute('playsinline', 'true');
    this.primaryAudio.setAttribute('webkit-playsinline', 'true');

    this.standbyAudio = new Audio();
    this.standbyAudio.preload = 'auto';
    this.standbyAudio.setAttribute('playsinline', 'true');
    this.standbyAudio.setAttribute('webkit-playsinline', 'true');

    this.attachPrimaryAudioListeners(this.primaryAudio);
  }

  /**
   * Attach all standard HTML5 audio event handlers to the primary deck
   */
  private attachPrimaryAudioListeners(audio: HTMLAudioElement) {
    // 1. loadedmetadata
    audio.addEventListener('loadedmetadata', () => {
      if (this.currentMode === 'audio' || this.currentMode === 'backend') {
        const dur = audio.duration;
        if (!isNaN(dur) && dur > 0) {
          this.currentTrackDuration = dur;
          mediaSessionService.setPositionState(audio.currentTime, dur);
        }
      }
    });

    // 2. canplay
    audio.addEventListener('canplay', () => {
      if (this.currentMode === 'audio' || this.currentMode === 'backend') {
        console.log(`[AudioEngine] canplay: readyState=${audio.readyState}`);
      }
    });

    // 3. playing
    audio.addEventListener('playing', () => {
      if (this.currentMode === 'audio' || this.currentMode === 'backend') {
        console.log(`[AudioEngine] play started: ${this.currentActiveTrack?.title || 'Unknown Track'}`);
      }
    });

    // 4. timeupdate
    audio.addEventListener('timeupdate', () => {
      if (this.currentMode === 'audio' || this.currentMode === 'backend') {
        this.handleTrackTimeCheck(audio.currentTime);
      }
    });

    // 5. waiting / stalled
    audio.addEventListener('waiting', () => {
      if (this.currentMode === 'audio' || this.currentMode === 'backend') {
        adaptiveBitrateService.updateBufferHealth(0);
      }
    });

    audio.addEventListener('stalled', () => {
      if (this.currentMode === 'audio' || this.currentMode === 'backend') {
        adaptiveBitrateService.updateBufferHealth(0);
      }
    });

    // 6. ended
    audio.addEventListener('ended', () => {
      if (this.currentMode === 'audio' || this.currentMode === 'backend') {
        console.log(`[AudioEngine] song ended naturally: ${this.currentActiveTrack?.title}`);
        if (this.onEndedCallback) {
          this.onEndedCallback();
        }
      }
    });

    // 7. abort & emptied
    audio.addEventListener('abort', () => {});
    audio.addEventListener('emptied', () => {});

    // 8. error (with full comprehensive diagnostic printing)
    audio.addEventListener('error', (e) => {
      if (this.currentMode === 'audio' || this.currentMode === 'backend') {
        this.handlePlaybackError(audio, 'HTMLAudioElement error event');
      }
    });
  }

  /**
   * Diagnostic Error Logger and Automatic Fallback Manager
   */
  private handlePlaybackError(audio: HTMLAudioElement, context: string) {
    const track = this.currentActiveTrack;
    const stream = this.currentStreamRecord;
    const url = audio.src || stream?.url || '';
    const ageMs = stream ? Date.now() - stream.obtainedAt : 0;
    const isBlob = url.startsWith('blob:');
    const isCached = stream ? this.streamUrlCache.has(track?.id || '') : false;

    console.warn(`[AudioEngine] playback error:`);
    console.warn(`  - current song ID: ${track?.id || 'unknown'}`);
    console.warn(`  - current song title: ${track?.title || 'unknown'}`);
    console.warn(`  - stream URL age: ${ageMs}ms`);
    console.warn(`  - stream MIME type: ${stream?.mimeType || 'unknown'}`);
    console.warn(`  - audio.readyState: ${audio.readyState}`);
    console.warn(`  - audio.networkState: ${audio.networkState}`);
    console.warn(`  - audio.error?.code: ${audio.error?.code}`);
    console.warn(`  - audio.error?.message: ${audio.error?.message || 'Media load failed'}`);
    console.warn(`  - whether the URL was cached: ${isCached}`);
    console.warn(`  - whether the source is Blob or remote URL: ${isBlob ? 'Blob URL' : 'Remote URL'}`);
    console.warn(`  - context: ${context}`);

    // Mark failed URL so it is never re-used
    if (url && !isBlob) {
      this.failedStreamUrls.add(url);
    }
    if (track) {
      this.streamUrlCache.delete(track.id);
    }

    // Trigger immediate stream refresh / fallback
    console.log(`[AudioEngine] stream refresh: Attempting resilient fallback for "${track?.title}"`);
    this.fallbackToNextSource(track);
  }

  /**
   * Fallback tier resolver
   */
  private async fallbackToNextSource(track: Track | null) {
    if (!track) {
      if (this.onErrorCallback) this.onErrorCallback('Playback failed');
      return;
    }

    // 1. If we were trying remote stream and track has videoId -> try YouTube IFrame player
    if (this.currentMode === 'audio' && track.videoId && !networkMonitorService.isOffline()) {
      console.log(`[AudioEngine] source attached: YouTube Player (Fallback for ${track.title})`);
      this.playYouTube(track.videoId);
      return;
    }

    // 2. If YouTube player or remote stream failed, we do NOT fallback to backend mock audio anymore.
    // Stop playback, release media, show clear error
    console.warn(`[AudioEngine] Playback failed for: "${track.title}". Releasing failed media item.`);
    
    this.isPlaying = false;
    if (this.primaryAudio) {
      this.primaryAudio.pause();
      this.primaryAudio.removeAttribute('src');
      this.primaryAudio.load();
    }
    
    if (this.onErrorCallback) {
      this.onErrorCallback(`Unable to play "${track.title}". The stream source is currently incompatible or unavailable.`);
    }
  }

  /**
   * Immediately silences and halts all active audio playback pipelines
   * Prevents old track audio bleed while a new track resolves or buffers
   */
  public stopImmediate() {
    this.isPlaying = false;
    this.stopYtTracker();

    // Instant silent WAV audio URI to force HTML5 audio buffer discard
    const SILENT_DATA_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

    if (this.primaryAudio) {
      try {
        this.primaryAudio.pause();
        this.primaryAudio.muted = true;
        this.primaryAudio.currentTime = 0;
        this.primaryAudio.src = SILENT_DATA_URI;
        this.primaryAudio.load();
      } catch {}
    }

    if (this.standbyAudio) {
      try {
        this.standbyAudio.pause();
        this.standbyAudio.muted = true;
        this.standbyAudio.currentTime = 0;
        this.standbyAudio.src = SILENT_DATA_URI;
        this.standbyAudio.load();
      } catch {}
    }

    if (this.ytPlayer) {
      try {
        if (typeof this.ytPlayer.mute === 'function') {
          this.ytPlayer.mute();
        }
        if (typeof this.ytPlayer.pauseVideo === 'function') {
          this.ytPlayer.pauseVideo();
        }
        if (typeof this.ytPlayer.stopVideo === 'function') {
          this.ytPlayer.stopVideo();
        }
        if (typeof this.ytPlayer.cueVideoById === 'function') {
          this.ytPlayer.cueVideoById('');
        }
      } catch {}
    }

    if (nativeAudioPlayerService.isNative()) {
      try {
        nativeAudioPlayerService.pause().catch(() => {});
      } catch {}
    }
  }

  /**
   * Primary Play function with Centralized Lifecycle Management
   */
  public async play(
    trackOrUrl: Track | { videoId?: string; audioUrl?: string; durationSec?: number } | string,
    onTimeUpdate?: (timeSec: number) => void,
    onEnded?: () => void,
    onError?: (err: string) => void,
    queue: Track[] = []
  ) {
    const reqId = ++this.playRequestId;
    
    // CRITICAL FIX: Instantly stop and silence previous track playback
    // so old song never bleeds into loading phase of next song
    this.stopImmediate();

    this.isPlaying = true;
    this.isInitialSilenceSkipped = false;
    this.isNextPrebuffered = false;
    this.activeQueue = queue;
    this.onTimeUpdateCallback = onTimeUpdate || null;
    this.onEndedCallback = onEnded || null;
    this.onErrorCallback = onError || null;

    if (this.backgroundPlayback) {
      this.ensureKeepAlive();
      this.requestWakeLock();
      persistentBackgroundService.startBackgroundSession();
    }

    // String URL or ID direct call
    if (typeof trackOrUrl === 'string') {
      this.currentTrackDuration = 0;
      if (trackOrUrl.startsWith('http') || trackOrUrl.startsWith('/api') || trackOrUrl.startsWith('blob:')) {
        this.attachAndPlayStream({
          url: trackOrUrl,
          mimeType: 'audio/mp4',
          obtainedAt: Date.now(),
          expiresAt: Date.now() + 600000,
          isBlob: trackOrUrl.startsWith('blob:'),
          sourceType: 'remote'
        }, null);
      } else {
        this.playYouTube(trackOrUrl);
      }
      return;
    }

    // Track Object
    const track = (typeof trackOrUrl === 'object' && 'id' in trackOrUrl) ? (trackOrUrl as Track) : null;
    if (track) {
      const prevTrack = this.currentActiveTrack;
      if (prevTrack && prevTrack.id !== track.id) {
        this.hasRetriedTrackId = null;
      }
      this.currentActiveTrack = track;
      this.currentTrackDuration = track.durationSec || 0;

      console.log(`[AudioEngine] song: ${track.title} (${track.id})`);
      if (prevTrack && prevTrack.id !== track.id) {
        console.log(`[AudioEngine] queue transition: "${prevTrack.title}" -> "${track.title}"`);
      }

      // Synchronize Lockscreen Metadata & Playback State
      mediaSessionService.updateMetadata(track, Boolean(track.isFavorite));
      mediaSessionService.setPlaybackState('playing');

      // Trigger lookahead pre-buffer of next track in queue right away
      if (queue.length > 0) {
        this.prefetchNextInQueue(track, queue);
      }
    } else {
      this.currentActiveTrack = null;
      mediaSessionService.setPlaybackState('playing');
    }

    const currentTrackObj = this.currentActiveTrack;
    if (!currentTrackObj) return;

    // Delegate to native Android ExoPlayer MediaSession service when running on Android
    if (nativeAudioPlayerService.isNative()) {
      if (this.primaryAudio) {
        this.primaryAudio.pause();
        this.primaryAudio.removeAttribute('src');
      }
      if (this.standbyAudio) {
        this.standbyAudio.pause();
        this.standbyAudio.removeAttribute('src');
      }
      if (this.silentAudio) {
        this.silentAudio.pause();
      }

      // For Android native playback, do NOT resolve audio stream through WebView first.
      // Pass existing direct audioUrl/streamUrl if available; otherwise empty string to let native StreamResolver handle it.
      let directUrl = currentTrackObj.audioUrl || currentTrackObj.streamUrl || '';
      let resolvedMimeType = 'audio/mp4';
      let resolvedStreamInfo: StreamInfo | null = null;

      if (reqId !== this.playRequestId) {
        console.log('[AudioEngine] Discarding stale play invocation');
        return;
      }

      logPlaybackDiagnostics(currentTrackObj, resolvedStreamInfo, directUrl, true);

      const currentIndex = Math.max(0, queue.findIndex((t) => t.id === currentTrackObj.id));
      await nativeAudioPlayerService.play(
        currentTrackObj,
        directUrl,
        queue,
        currentIndex,
        this.repeatMode,
        this.isShuffle,
        resolvedMimeType
      );
      return;
    }

    // Ensure native player is paused/reset when playing via HTML5 audio
    try {
      if (nativeAudioPlayerService.isNative()) {
        nativeAudioPlayerService.pause().catch(() => {});
      }
    } catch {}

    // Check if offline or downloaded in encrypted vault
    const isOffline = networkMonitorService.isOffline() || offlineService.isOfflineOnlyMode();
    if (isOffline || offlineService.isDownloaded(currentTrackObj.id)) {
      try {
        const decryptedBlobUrl = await encryptedStorageService.getDecryptedAudioUrl(currentTrackObj.id);
        if (decryptedBlobUrl && reqId === this.playRequestId) {
          console.log(`[AudioEngine] source attached: Encrypted Vault Blob URL for ${currentTrackObj.title}`);
          this.attachAndPlayStream(
            {
              url: decryptedBlobUrl,
              mimeType: 'audio/mp4',
              obtainedAt: Date.now(),
              expiresAt: Date.now() + 3600 * 1000,
              isBlob: true,
              sourceType: 'blob'
            },
            currentTrackObj
          );
          return;
        }
      } catch (err) {
        console.warn('[AudioEngine] Vault decryption failed, continuing to online streams:', err);
      }
    }

    // Check if the song was already preloaded on standby deck!
    if (this.prebufferedTrack && this.prebufferedTrack.id === currentTrackObj.id && this.standbyAudio && this.standbyAudio.src) {
      console.log(`[AudioEngine] ⚡ Zero-Latency Instant Switch! Playing preloaded audio for: "${currentTrackObj.title}"`);
      const preloadedUrl = this.standbyAudio.src;
      this.prebufferedTrack = null;
      this.prebufferedBlobUrl = null;
      adaptiveBitrateService.setPrebufferStatus(false);

      const cachedRecord = this.streamUrlCache.get(currentTrackObj.id) || {
        url: preloadedUrl,
        mimeType: 'audio/mp4',
        obtainedAt: Date.now(),
        expiresAt: Date.now() + 3600 * 1000,
        isBlob: false,
        sourceType: 'remote'
      };

      this.attachAndPlayStream(cachedRecord, currentTrackObj);
      return;
    }

    // Check Stream URL Cache (with strict expiration & blacklist checks)
    const cachedRecord = this.streamUrlCache.get(currentTrackObj.id);
    if (cachedRecord && !this.isStreamExpired(cachedRecord) && !this.failedStreamUrls.has(cachedRecord.url)) {
      console.log(`[AudioEngine] stream URL validation: VALID (Cached, age: ${Date.now() - cachedRecord.obtainedAt}ms)`);
      this.attachAndPlayStream(cachedRecord, currentTrackObj);
      return;
    }

    // Obtain fresh stream URL
    this.resolveAndPlayFreshStream(currentTrackObj, reqId);
  }

  /**
   * Resolves a fresh stream URL from remote API / backend / YouTube
   */
  private async resolveAndPlayFreshStream(track: Track, reqId: number) {
    if (track.videoId && !networkMonitorService.isOffline()) {
      try {
        const streamInfo: StreamInfo | null = await getAudioStreamInfo(track.videoId);
        if (reqId !== this.playRequestId) return; // Discard stale requests

        if (streamInfo && streamInfo.url && !this.failedStreamUrls.has(streamInfo.url)) {
          console.log(`[AudioEngine] stream URL obtained: ${streamInfo.url.substring(0, 70)}...`);
          console.log(`[AudioEngine] stream URL validation: VALID (${streamInfo.mimeType}, expires in ${Math.round((streamInfo.expiresAt - Date.now()) / 1000)}s)`);

          logPlaybackDiagnostics(track, streamInfo, streamInfo.url, nativeAudioPlayerService.isNative());

          const streamRecord: CachedStreamRecord = {
            url: streamInfo.url,
            mimeType: streamInfo.mimeType || 'audio/mp4',
            obtainedAt: Date.now(),
            expiresAt: streamInfo.expiresAt,
            isBlob: false,
            sourceType: 'remote'
          };

          this.streamUrlCache.set(track.id, streamRecord);
          this.attachAndPlayStream(streamRecord, track);
          return;
        }
      } catch (e) {
        console.warn('[AudioEngine] Stream extraction exception:', e);
      }
    }

    if (reqId !== this.playRequestId) return;

    // Direct YouTube Player Fallback if videoId exists
    if (track.videoId && !networkMonitorService.isOffline()) {
      console.log(`[AudioEngine] source attached: YouTube Player for "${track.title}"`);
      this.playYouTube(track.videoId);
      return;
    }

    // Backend continuous audio stream route
    const backendUrl = `/api/stream/${track.id}/audio?duration=${track.durationSec || 210}`;
    console.log(`[AudioEngine] source attached: Backend Stream for "${track.title}"`);
    const backendRecord: CachedStreamRecord = {
      url: backendUrl,
      mimeType: 'audio/wav',
      obtainedAt: Date.now(),
      expiresAt: Date.now() + 3600 * 1000,
      isBlob: false,
      sourceType: 'backend'
    };
    this.streamUrlCache.set(track.id, backendRecord);
    this.attachAndPlayStream(backendRecord, track);
  }

  /**
   * Helper to check if a stream record has expired
   */
  private isStreamExpired(record: CachedStreamRecord): boolean {
    if (record.isBlob) return false;
    // Expired if current time is within 15 seconds of expiresAt
    return Date.now() >= record.expiresAt - 15000;
  }

  /**
   * Attaches audio source to primary deck and starts playback cleanly
   */
  private attachAndPlayStream(streamRecord: CachedStreamRecord, track: Track | null) {
    if (nativeAudioPlayerService.isNative()) {
      console.log('[AudioEngine] Bypassing HTML5 attachAndPlayStream because we are in native mode');
      return;
    }
    this.currentMode = streamRecord.sourceType === 'backend' ? 'backend' : 'audio';
    this.currentStreamRecord = streamRecord;

    // Pause YouTube player if active
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try { this.ytPlayer.pauseVideo(); } catch {}
    }
    this.stopYtTracker();

    if (!this.primaryAudio) return;

    // Safe Blob URL Tracking: retain active Blob URL and do not revoke while in use
    const prevSrc = this.primaryAudio.src;
    if (streamRecord.isBlob && track) {
      this.activeBlobUrls.set(track.id, streamRecord.url);
    }

    // Only update src if changed to avoid unnecessary reloads
    if (this.primaryAudio.src !== streamRecord.url) {
      this.primaryAudio.pause();
      this.primaryAudio.src = streamRecord.url;
      this.primaryAudio.load();
      console.log(`[AudioEngine] source attached: ${streamRecord.isBlob ? 'Blob URL' : streamRecord.url.substring(0, 60)}`);
    }

    this.primaryAudio.muted = false;
    this.applyVolume();

    // Verify and play with proper Promise error handling
    const playPromise = this.primaryAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn(`[AudioEngine] HTML5 Audio playback interrupted:`, err);
          this.handlePlaybackError(this.primaryAudio!, 'play() promise rejection');
        }
      });
    }

    // Clean up previous Blob URL if it is no longer playing
    if (prevSrc && prevSrc.startsWith('blob:') && prevSrc !== streamRecord.url && prevSrc !== this.prebufferedBlobUrl) {
      // Find trackId for prevSrc and revoke
      for (const [tId, bUrl] of this.activeBlobUrls.entries()) {
        if (bUrl === prevSrc && (!track || tId !== track.id)) {
          URL.revokeObjectURL(prevSrc);
          this.activeBlobUrls.delete(tId);
          break;
        }
      }
    }
  }

  /**
   * Lookahead Pre-buffering of the next song in the queue
   */
  public async prefetchNextInQueue(currentTrack: Track, queue: Track[]) {
    try {
      if (nativeAudioPlayerService.isNative()) return;

      const queueIds = queue.map((t) => t.id).filter((id) => id !== currentTrack.id);
      const metrics = adaptiveBitrateService.getMetrics();

      const res = await fetch('/api/stream/predict-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTrackId: currentTrack.id,
          queueIds,
          networkSpeedKbps: metrics.networkSpeedKbps
        })
      });

      if (!res.ok) return;
      const data = await res.json();
      const prediction = data.prediction;
      if (!prediction || !prediction.nextTrackId) return;

      const nextTrack = queue.find((t) => t.id === prediction.nextTrackId) || {
        id: prediction.nextTrackId,
        title: 'Next Track in Queue',
        artist: 'Streamzy Auto-Stream',
        album: 'YouTube Music Queue',
        duration: '3:30',
        durationSec: 210,
        coverUrl: '/streamzy_logo.jpg',
        videoId: prediction.nextTrackId
      } as Track;

      // Check if already pre-buffered / cached
      const cachedRecord = this.streamUrlCache.get(nextTrack.id);
      if (cachedRecord && !this.isStreamExpired(cachedRecord)) {
        return;
      }

      console.log(`[AudioEngine] prebuffer started (resolving stream): "${nextTrack.title}"`);
      if (nextTrack.videoId && !networkMonitorService.isOffline()) {
        const fetchStart = performance.now();
        const streamInfo = await getAudioStreamInfo(nextTrack.videoId);
        if (streamInfo && streamInfo.url) {
          const fetchTimeMs = performance.now() - fetchStart;
          const streamRecord: CachedStreamRecord = {
            url: streamInfo.url,
            mimeType: streamInfo.mimeType || 'audio/mp4',
            obtainedAt: Date.now(),
            expiresAt: streamInfo.expiresAt,
            isBlob: false,
            sourceType: 'remote'
          };
          this.streamUrlCache.set(nextTrack.id, streamRecord);

          // Preload on standby deck
          if (this.standbyAudio) {
            this.standbyAudio.src = streamInfo.url;
            this.standbyAudio.load();
            this.prebufferedTrack = nextTrack;
            this.prebufferedBlobUrl = null; // No mock blob url
            adaptiveBitrateService.setPrebufferStatus(true, nextTrack.id, nextTrack.title);
            console.log(`[AudioEngine] standby deck preloaded with real stream URL for: "${nextTrack.title}" (resolved in ${Math.round(fetchTimeMs)}ms)`);
          }
        }
      }
    } catch (e) {
      console.warn('[AudioEngine] Pre-buffer request bypassed', e);
    }
  }

  /**
   * Track Progress & Segment Tracking
   */
  private handleTrackTimeCheck(currentTime: number) {
    if (typeof currentTime !== 'number' || isNaN(currentTime)) return;

    // 1. Skip Sponsor Segments
    if (this.skipSponsor && this.sponsorSegments.length > 0) {
      for (const seg of this.sponsorSegments) {
        if (currentTime >= seg.start - 0.2 && currentTime < seg.end - 0.4) {
          this.seek(seg.end);
          return;
        }
      }
    }

    // 2. Skip Silence: Intro Trimming
    if (this.skipSilence && !this.isInitialSilenceSkipped && currentTime >= 0 && currentTime < 0.8) {
      this.isInitialSilenceSkipped = true;
      if (currentTime < 1.4) {
        this.seek(1.5);
        return;
      }
    }

    // 3. Skip Silence: Outro Trimming for smooth gapless auto-transition
    if (this.skipSilence && this.currentTrackDuration > 12) {
      if (currentTime >= this.currentTrackDuration - 2.5) {
        this.currentTrackDuration = 0;
        if (this.onEndedCallback) {
          this.onEndedCallback();
          return;
        }
      }
    }

    // 4. Update Adaptive Bitrate buffer health metrics
    if (this.primaryAudio && (this.currentMode === 'audio' || this.currentMode === 'backend')) {
      const current = this.primaryAudio.currentTime;
      let maxBuf = current;
      for (let i = 0; i < this.primaryAudio.buffered.length; i++) {
        if (this.primaryAudio.buffered.start(i) <= current && this.primaryAudio.buffered.end(i) >= current) {
          maxBuf = this.primaryAudio.buffered.end(i);
          break;
        }
      }
      adaptiveBitrateService.updateBufferHealth(Math.max(0, maxBuf - current));
    } else if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getVideoLoadedFraction === 'function') {
      try {
        const frac = this.ytPlayer.getVideoLoadedFraction() || 0;
        const dur = this.currentTrackDuration || 210;
        adaptiveBitrateService.updateBufferHealth(Math.max(0, frac * dur - currentTime));
      } catch {}
    }

    // 5. Lookahead Pre-buffering: Trigger when nearing finish (<= 20s remaining)
    if (this.currentTrackDuration > 20 && currentTime >= this.currentTrackDuration - 20 && !this.isNextPrebuffered) {
      this.isNextPrebuffered = true;
      if (this.currentActiveTrack && this.activeQueue.length > 0) {
        this.prefetchNextInQueue(this.currentActiveTrack, this.activeQueue);
      }
    }

    // 6. Update MediaSession Position State
    if (this.currentTrackDuration > 0) {
      mediaSessionService.setPositionState(currentTime, this.currentTrackDuration);
    }

    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(currentTime);
    }
  }

  /**
   * YouTube Player Fallback Initialization
   */
  private initYouTubePlayer() {
    if (typeof document === 'undefined') return;

    let container = document.getElementById(this.ytContainerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.ytContainerId;
      container.style.position = 'fixed';
      container.style.bottom = '0px';
      container.style.right = '0px';
      container.style.width = '160px';
      container.style.height = '160px';
      container.style.opacity = '0.001';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '-9999';
      document.body.appendChild(container);
    }

    const checkYTApi = () => {
      if (window.YT && window.YT.Player) {
        this.createYtInstance();
      } else {
        const prevOnReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevOnReady) prevOnReady();
          this.createYtInstance();
        };
      }
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      checkYTApi();
    } else {
      window.addEventListener('DOMContentLoaded', checkYTApi);
    }
  }

  private createYtInstance() {
    if (this.ytPlayer || typeof window.YT === 'undefined' || !window.YT.Player) return;

    try {
      this.ytPlayer = new window.YT.Player(this.ytContainerId, {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: () => {
            this.isYtReady = true;
            if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
              this.ytPlayer.setVolume(Math.round(this.volume * 100));
            }
            if (this.pendingVideoId) {
              const vid = this.pendingVideoId;
              this.pendingVideoId = null;
              this.playYouTube(vid);
            }
          },
          onStateChange: (event: any) => {
            if (event.data === 1) {
              this.startYtTracker();
            } else if (event.data === 0) {
              this.stopYtTracker();
              if (this.onEndedCallback) {
                this.onEndedCallback();
              }
            } else if (event.data === 2) {
              this.stopYtTracker();
              if (this.isPlaying && this.backgroundPlayback) {
                setTimeout(() => {
                  if (this.isPlaying && this.ytPlayer) {
                    try { this.ytPlayer.playVideo(); } catch {}
                  }
                }, 50);
              }
            }
          },
          onError: (err: any) => {
            console.warn('[AudioEngine] YouTube Player error:', err);
            this.stopYtTracker();
            this.fallbackToNextSource(this.currentActiveTrack);
          }
        }
      });
    } catch (e) {
      console.warn('[AudioEngine] Could not initialize YouTube player:', e);
    }
  }

  private playYouTube(videoId: string) {
    if (nativeAudioPlayerService.isNative()) {
      console.log('[AudioEngine] Bypassing HTML5 playYouTube because we are in native mode');
      return;
    }
    this.currentMode = 'youtube';
    this.fetchSponsorSegments(videoId);

    if (this.primaryAudio) {
      this.primaryAudio.pause();
    }

    if (!this.isYtReady || !this.ytPlayer || typeof this.ytPlayer.loadVideoById !== 'function') {
      this.pendingVideoId = videoId;
      return;
    }

    try {
      if (typeof this.ytPlayer.unMute === 'function') {
        this.ytPlayer.unMute();
      }
      this.ytPlayer.loadVideoById({ videoId, startSeconds: 0 });
      this.applyVolume();
      this.ytPlayer.playVideo();
      this.startYtTracker();
    } catch (e) {
      console.warn('[AudioEngine] Error playing video in YouTube player:', e);
      this.fallbackToNextSource(this.currentActiveTrack);
    }
  }

  private async fetchSponsorSegments(videoId: string) {
    this.sponsorSegments = [];
    if (!this.skipSponsor || !videoId) return;

    try {
      const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=["music_offtopic","sponsor","intro"]`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.sponsorSegments = data
            .filter((item: any) => Array.isArray(item.segment) && item.segment.length >= 2)
            .map((item: any) => ({
              start: Number(item.segment[0]),
              end: Number(item.segment[1])
            }))
            .sort((a, b) => a.start - b.start);

          if (this.sponsorSegments.length > 0 && this.sponsorSegments[0].start <= 2.5) {
            const skipTo = this.sponsorSegments[0].end;
            setTimeout(() => this.seek(skipTo), 300);
          }
        }
      }
    } catch {}
  }

  private startYtTracker() {
    this.stopYtTracker();
    this.ytInterval = window.setInterval(() => {
      if (this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
        try {
          const currentTime = this.ytPlayer.getCurrentTime();
          if (typeof currentTime === 'number' && !isNaN(currentTime)) {
            this.handleTrackTimeCheck(currentTime);
          }
        } catch {}
      }
    }, 400);
  }

  private stopYtTracker() {
    if (this.ytInterval) {
      clearInterval(this.ytInterval);
      this.ytInterval = null;
    }
  }

  /**
   * Pause & Resume Controls
   */
  public pause() {
    this.isPlaying = false;
    this.stopYtTracker();
    this.releaseWakeLock();
    persistentBackgroundService.stopBackgroundSession();
    mediaSessionService.setPlaybackState('paused');

    if (nativeAudioPlayerService.isNative()) {
      nativeAudioPlayerService.pause();
      return;
    }

    if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try { this.ytPlayer.pauseVideo(); } catch {}
    } else if (this.primaryAudio) {
      this.primaryAudio.pause();
    }
  }

  public resume() {
    this.isPlaying = true;

    if (nativeAudioPlayerService.isNative()) {
      nativeAudioPlayerService.resume();
      return;
    }

    if (this.backgroundPlayback) {
      this.ensureKeepAlive();
      this.requestWakeLock();
      persistentBackgroundService.startBackgroundSession();
    }
    mediaSessionService.setPlaybackState('playing');

    if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
      try {
        this.ytPlayer.playVideo();
        this.startYtTracker();
      } catch {
        this.fallbackToNextSource(this.currentActiveTrack);
      }
    } else if (this.primaryAudio && this.primaryAudio.src) {
      this.primaryAudio.play().catch((err) => {
        if (err.name !== 'AbortError') {
          this.handlePlaybackError(this.primaryAudio!, 'resume() promise rejection');
        }
      });
    } else if (this.currentActiveTrack) {
      this.play(this.currentActiveTrack);
    }
  }

  public seek(seconds: number) {
    if (nativeAudioPlayerService.isNative()) {
      nativeAudioPlayerService.seek(seconds);
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(seconds);
      }
      return;
    }

    if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      try { this.ytPlayer.seekTo(seconds, true); } catch {}
    } else if (this.primaryAudio && !isNaN(seconds) && isFinite(seconds)) {
      this.primaryAudio.currentTime = seconds;
    }
    if (this.currentTrackDuration > 0) {
      mediaSessionService.setPositionState(seconds, this.currentTrackDuration);
    }
  }

  public setRepeatMode(mode: 'off' | 'all' | 'one') {
    this.repeatMode = mode;
    if (nativeAudioPlayerService.isNative()) {
      nativeAudioPlayerService.setRepeatMode(mode);
    }
  }

  public setShuffleMode(shuffle: boolean) {
    this.isShuffle = shuffle;
    if (nativeAudioPlayerService.isNative()) {
      nativeAudioPlayerService.setShuffleMode(shuffle);
    }
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyVolume();
  }

  public applyVolume() {
    const baseVolume = this.volumeNormalization ? this.volume * 0.84 : this.volume;
    const effectiveVolume = Math.max(0, Math.min(1, baseVolume * this.audioFocusMultiplier));

    if (this.primaryAudio) {
      this.primaryAudio.volume = effectiveVolume;
    }
    if (this.standbyAudio) {
      this.standbyAudio.volume = effectiveVolume;
    }
    if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      try {
        this.ytPlayer.setVolume(Math.round(effectiveVolume * 100));
      } catch {}
    }
  }

  public setExternalControls(onNext: () => void, onPrev: () => void) {
    this.onNextTrackExternal = onNext;
    this.onPrevTrackExternal = onPrev;
  }

  public configure(options: {
    volumeNormalization?: boolean;
    skipSilence?: boolean;
    skipSponsor?: boolean;
    audioQuality?: string;
    streamingInstance?: string;
    backgroundPlayback?: boolean;
  }) {
    if (options.volumeNormalization !== undefined) {
      this.volumeNormalization = options.volumeNormalization;
      this.applyVolume();
    }
    if (options.skipSilence !== undefined) this.skipSilence = options.skipSilence;
    if (options.skipSponsor !== undefined) this.skipSponsor = options.skipSponsor;
    if (options.audioQuality !== undefined) this.audioQuality = options.audioQuality;
    if (options.streamingInstance !== undefined) this.streamingInstance = options.streamingInstance;
    if (options.backgroundPlayback !== undefined) {
      this.backgroundPlayback = options.backgroundPlayback;
      persistentBackgroundService.setScreenOffPlayback(Boolean(options.backgroundPlayback));
      if (this.backgroundPlayback && this.isPlaying) {
        this.ensureKeepAlive();
        this.requestWakeLock();
        persistentBackgroundService.startBackgroundSession();
      } else if (!this.backgroundPlayback) {
        this.releaseWakeLock();
        persistentBackgroundService.stopBackgroundSession();
      }
    }
  }

  public setPreset(_preset: string) {}

  public async enableBackgroundPlayback(): Promise<void> {
    this.backgroundPlayback = true;
    persistentBackgroundService.setScreenOffPlayback(true);
    this.ensureKeepAlive();
    await this.requestWakeLock();
    persistentBackgroundService.startBackgroundSession();
  }

  public getPrebufferedTrack(): Track | null {
    return this.prebufferedTrack;
  }

  private initSilentKeepAlive() {
    if (nativeAudioPlayerService.isNative()) return;
    try {
      this.silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      this.silentAudio.loop = true;
      this.silentAudio.volume = 0.0001;
      this.silentAudio.setAttribute('playsinline', 'true');
      this.silentAudio.setAttribute('webkit-playsinline', 'true');
    } catch {}
  }

  private ensureKeepAlive() {
    if (nativeAudioPlayerService.isNative() || !this.backgroundPlayback) return;
    try {
      if (this.silentAudio && this.silentAudio.paused) {
        this.silentAudio.play().catch(() => {});
      }
    } catch {}
  }

  private async requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        if (!this.wakeLock) {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
          this.wakeLock.addEventListener('release', () => {
            this.wakeLock = null;
          });
        }
      } catch {}
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock) {
      try { this.wakeLock.release(); } catch {}
      this.wakeLock = null;
    }
  }

  private initMediaSession() {
    mediaSessionService.registerCallbacks({
      onPlay: () => this.resume(),
      onPause: () => this.pause(),
      onNext: () => {
        if (this.onNextTrackExternal) {
          this.onNextTrackExternal();
        } else if (this.onEndedCallback) {
          this.onEndedCallback();
        }
      },
      onPrevious: () => {
        if (this.onPrevTrackExternal) {
          this.onPrevTrackExternal();
        } else {
          this.seek(0);
        }
      },
      onSeek: (seconds) => this.seek(seconds)
    });
  }

  private initAudioFocus() {
    audioFocusService.registerPlayerControls(
      () => this.pause(),
      () => this.resume(),
      (multiplier) => {
        this.audioFocusMultiplier = multiplier;
        this.applyVolume();
      }
    );
  }

  private initAppLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.isPlaying && this.backgroundPlayback) {
          this.ensureKeepAlive();
        }
      } else {
        if (this.isPlaying) {
          this.requestWakeLock();
        }
      }
    });

    try {
      App.addListener('appStateChange', (state) => {
        if (!state.isActive) {
          if (this.isPlaying && this.backgroundPlayback) {
            this.ensureKeepAlive();
          }
        } else {
          if (this.isPlaying) {
            this.requestWakeLock();
          }
        }
      });
    } catch {}
  }

  private initNetworkAutoSwitch() {
    networkMonitorService.subscribe((netState) => {
      if (!netState.isOnline && this.isPlaying && this.currentMode === 'youtube') {
        if (this.currentActiveTrack) {
          encryptedStorageService.getDecryptedAudioUrl(this.currentActiveTrack.id).then((blobUrl) => {
            if (blobUrl) {
              this.attachAndPlayStream(
                {
                  url: blobUrl,
                  mimeType: 'audio/mp4',
                  obtainedAt: Date.now(),
                  expiresAt: Date.now() + 3600 * 1000,
                  isBlob: true,
                  sourceType: 'blob'
                },
                this.currentActiveTrack
              );
            }
          });
        }
      }
    });
  }
}

export const audioEngine = new AudioEngine();
