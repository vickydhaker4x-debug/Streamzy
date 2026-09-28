/**
 * Module 2: Persistent Background Execution & Audio Session Management
 * Ensures audio playback continues uninterrupted when:
 * 1. The device screen is locked
 * 2. The user switches to another app or home screen
 * 3. The browser tab is hidden or backgrounded
 */

import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

class PersistentBackgroundService {
  private wakeLock: any = null;
  private audioCtx: AudioContext | null = null;
  private silentLoopElement: HTMLAudioElement | null = null;
  private keepAliveGainNode: GainNode | null = null;
  private isKeepAliveRunning: boolean = false;
  private isScreenOffPlaybackEnabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initBackgroundListeners();
      this.initSilentAudioLoop();
    }
  }

  /**
   * Initializes silent hardware keep-alive loop.
   * On Web, browsers allow background execution as long as an active Audio element
   * continues outputting to the hardware audio buffer.
   * On Native Android/iOS, this is completely bypassed to prevent AudioFocus conflicts with ExoPlayer.
   */
  private initSilentAudioLoop() {
    if (Capacitor.isNativePlatform()) {
      return;
    }
    try {
      this.silentLoopElement = new Audio();
      // 1-second ultra-low frequency silent wav base64
      this.silentLoopElement.src =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      this.silentLoopElement.loop = true;
      this.silentLoopElement.volume = 0.0001; // virtually inaudible, but signals active hardware stream
      this.silentLoopElement.setAttribute('playsinline', 'true');
      this.silentLoopElement.setAttribute('webkit-playsinline', 'true');
    } catch (e) {
      console.warn('Silent loop audio setup skipped', e);
    }
  }

  private initBackgroundListeners() {
    // 1. Web Page Visibility API
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (!Capacitor.isNativePlatform()) {
          console.log('[PersistentBackground] App backgrounded - reinforcing audio session keep-alive');
          this.reinforceSession();
        }
      } else if (document.visibilityState === 'visible') {
        if (!Capacitor.isNativePlatform()) {
          console.log('[PersistentBackground] App foregrounded - restoring wake lock');
          this.acquireWakeLock();
        }
      }
    });

    // 2. Page Lifecycle (Page Freeze / Resume)
    window.addEventListener('freeze', () => {
      if (!Capacitor.isNativePlatform()) {
        this.reinforceSession();
      }
    });

    window.addEventListener('resume', () => {
      if (!Capacitor.isNativePlatform()) {
        this.acquireWakeLock();
      }
    });

    // 3. Capacitor Native Mobile App State
    try {
      CapApp.addListener('appStateChange', (state) => {
        if (!Capacitor.isNativePlatform()) {
          if (!state.isActive) {
            this.reinforceSession();
          } else {
            this.acquireWakeLock();
          }
        }
      });
    } catch {
      // Not running in Capacitor native container
    }
  }

  /**
   * Reinforce audio hardware thread when entering background or screen lock (Web only)
   */
  public reinforceSession() {
    if (Capacitor.isNativePlatform() || !this.isScreenOffPlaybackEnabled) return;

    if (this.silentLoopElement && this.silentLoopElement.paused) {
      this.silentLoopElement.play().catch(() => {});
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  /**
   * Start persistent background execution when playback begins (Web only)
   */
  public startBackgroundSession() {
    if (Capacitor.isNativePlatform()) return;
    this.isKeepAliveRunning = true;
    this.acquireWakeLock();
    this.startAudioHardwareKeepAlive();

    if (this.silentLoopElement && this.silentLoopElement.paused) {
      this.silentLoopElement.play().catch(() => {});
    }
  }

  /**
   * Stop background session when user pauses or stops
   */
  public stopBackgroundSession() {
    if (Capacitor.isNativePlatform()) return;
    this.isKeepAliveRunning = false;
    this.releaseWakeLock();

    if (this.silentLoopElement && !this.silentLoopElement.paused) {
      this.silentLoopElement.pause();
    }
  }

  /**
   * Keep-Alive AudioContext Node
   */
  private startAudioHardwareKeepAlive() {
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
        }
      }

      if (this.audioCtx) {
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }

        // Create an inaudible oscillator running at 10Hz through gain 0.0001
        if (!this.keepAliveGainNode) {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(10, this.audioCtx.currentTime);
          gain.gain.setValueAtTime(0.00001, this.audioCtx.currentTime);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start();
          this.keepAliveGainNode = gain;
        }
      }
    } catch (e) {
      console.warn('Audio keep alive initiation deferred', e);
    }
  }

  /**
   * Screen WakeLock API
   */
  public async acquireWakeLock() {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      if (!this.wakeLock) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      }
    } catch {
      // WakeLock may fail if tab is not focused or battery saver is active
    }
  }

  public releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch {}
      this.wakeLock = null;
    }
  }

  public setScreenOffPlayback(enabled: boolean) {
    this.isScreenOffPlaybackEnabled = enabled;
    if (!enabled) {
      this.stopBackgroundSession();
    } else if (this.isKeepAliveRunning) {
      this.startBackgroundSession();
    }
  }

  public isRunning(): boolean {
    return this.isKeepAliveRunning;
  }
}

export const persistentBackgroundService = new PersistentBackgroundService();
