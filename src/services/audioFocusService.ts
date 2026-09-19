/**
 * Module 2: Audio Focus Management & Interruption Handling
 * Handles:
 * 1. Audio ducking for GPS notifications / assistant speech
 * 2. Transient pause for incoming calls & alarms, with auto-resume
 * 3. Headphone unplug / Bluetooth disconnection auto-pause (becoming noisy safeguard)
 */

export type AudioFocusState = 'gain' | 'duck' | 'loss_transient' | 'loss';

export interface AudioFocusEvent {
  state: AudioFocusState;
  reason: string;
  volumeMultiplier: number;
}

type AudioFocusListener = (event: AudioFocusEvent) => void;

class AudioFocusService {
  private currentState: AudioFocusState = 'gain';
  private wasPlayingBeforeInterruption: boolean = false;
  private currentVolumeMultiplier: number = 1.0;
  private listeners: Set<AudioFocusListener> = new Set();
  private duckTimeout: any = null;

  // External audio controller hook
  private onPauseRequest: (() => void) | null = null;
  private onResumeRequest: (() => void) | null = null;
  private onVolumeDuckingChange: ((multiplier: number) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initHardwareInterruptionListeners();
    }
  }

  public registerPlayerControls(
    pause: () => void,
    resume: () => void,
    setDuckedVolume: (multiplier: number) => void
  ) {
    this.onPauseRequest = pause;
    this.onResumeRequest = resume;
    this.onVolumeDuckingChange = setDuckedVolume;
  }

  public subscribe(listener: AudioFocusListener): () => void {
    this.listeners.add(listener);
    listener({
      state: this.currentState,
      reason: 'Initial state',
      volumeMultiplier: this.currentVolumeMultiplier
    });
    return () => this.listeners.delete(listener);
  }

  private notify(reason: string) {
    const event: AudioFocusEvent = {
      state: this.currentState,
      reason,
      volumeMultiplier: this.currentVolumeMultiplier
    };
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch (e) {
        console.error(e);
      }
    });
  }

  /**
   * Listen to audio device hardware changes (Headphone disconnect / Bluetooth unpair)
   */
  private initHardwareInterruptionListeners() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      try {
        navigator.mediaDevices.addEventListener('devicechange', () => {
          this.handleHeadphonesDisconnected();
        });
      } catch (e) {
        console.warn('Audio device listener not supported', e);
      }
    }

    // Page Visibility and OS Interruption Listeners
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        // When document visibility changes, verify audio context is active
      });
    }
  }

  /**
   * Headphone / Bluetooth unplug safeguard:
   * Android & iOS standard "becoming noisy" action: immediately pause
   */
  public handleHeadphonesDisconnected() {
    console.log('[AudioFocus] Headphone/Bluetooth unplugged - pausing playback to prevent noisy blast');
    if (this.onPauseRequest) {
      this.onPauseRequest();
    }
    this.currentState = 'loss';
    this.notify('Headphones/Bluetooth disconnected');
  }

  /**
   * Audio Ducking: GPS prompt, voice message, turn-by-turn navigation
   * Smoothly dips volume to 20% and restores automatically after duration
   */
  public duckAudio(durationMs: number = 3200) {
    if (this.duckTimeout) {
      clearTimeout(this.duckTimeout);
      this.duckTimeout = null;
    }

    this.currentState = 'duck';
    this.currentVolumeMultiplier = 0.20; // 20% ducked volume
    if (this.onVolumeDuckingChange) {
      this.onVolumeDuckingChange(0.20);
    }
    this.notify('Audio ducked for incoming prompt/GPS');

    this.duckTimeout = setTimeout(() => {
      this.restoreAudioGain('Prompt finished, volume restored');
    }, durationMs);
  }

  /**
   * Restore full audio gain from ducking
   */
  public restoreAudioGain(reason: string = 'Focus restored') {
    if (this.duckTimeout) {
      clearTimeout(this.duckTimeout);
      this.duckTimeout = null;
    }

    this.currentState = 'gain';
    this.currentVolumeMultiplier = 1.0;
    if (this.onVolumeDuckingChange) {
      this.onVolumeDuckingChange(1.0);
    }
    this.notify(reason);
  }

  /**
   * Transient Interruption: Incoming phone call or alarm
   * Pauses audio, remembers playing state, and resumes when call ends
   */
  public handleIncomingInterruption(currentlyPlaying: boolean) {
    this.wasPlayingBeforeInterruption = currentlyPlaying;
    this.currentState = 'loss_transient';
    if (currentlyPlaying && this.onPauseRequest) {
      this.onPauseRequest();
    }
    this.notify('Paused for incoming phone call or alarm');
  }

  /**
   * Call ended or alarm dismissed: Resume automatically if it was playing before
   */
  public handleInterruptionEnded() {
    this.currentState = 'gain';
    this.currentVolumeMultiplier = 1.0;
    if (this.onVolumeDuckingChange) {
      this.onVolumeDuckingChange(1.0);
    }

    if (this.wasPlayingBeforeInterruption && this.onResumeRequest) {
      this.onResumeRequest();
      this.notify('Call ended - automatically resumed playback');
    } else {
      this.notify('Interruption ended');
    }
    this.wasPlayingBeforeInterruption = false;
  }

  /**
   * Permanent focus loss: User opened YouTube or another media app
   */
  public handlePermanentFocusLoss() {
    this.currentState = 'loss';
    this.wasPlayingBeforeInterruption = false;
    if (this.onPauseRequest) {
      this.onPauseRequest();
    }
    this.notify('Permanent audio focus lost to external player');
  }

  public getState(): AudioFocusState {
    return this.currentState;
  }

  public getVolumeMultiplier(): number {
    return this.currentVolumeMultiplier;
  }
}

export const audioFocusService = new AudioFocusService();
