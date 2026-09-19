/**
 * Module 5: Client-Side Silent Telemetry Pipeline
 * 
 * Silently instruments playback:
 * - Start events
 * - Heartbeat / listened duration aggregation
 * - Skips (tracks skipped before 85% completion or < 30s)
 * - Completions (tracks finished or played >= 85%)
 * - Loop events
 * 
 * Non-blocking, zero-latency execution feeding the server ML recommendation loop.
 */

import { authClient } from './authClient';

export interface TelemetryLogEntry {
  id: string;
  trackId: string;
  trackTitle?: string;
  eventType: 'START' | 'PROGRESS' | 'SKIP' | 'COMPLETE' | 'LOOP';
  listenedDurationSec: number;
  trackDurationSec: number;
  completionPercent: number;
  skipReason?: string;
  timestamp: number;
}

type TelemetryListener = (log: TelemetryLogEntry) => void;

class TelemetryClient {
  private activeTrackId: string | null = null;
  private activeTrackTitle: string | null = null;
  private activeTrackDuration = 0;
  private playbackStartedAt = 0;
  private accumulatedListenedSec = 0;
  private lastPositionSec = 0;
  private isCompletedRecorded = false;
  private isSkippedRecorded = false;
  private listeners: Set<TelemetryListener> = new Set();
  private recentLogs: TelemetryLogEntry[] = [];

  /**
   * Called when a track starts playing
   */
  public onTrackStart(trackId: string, trackTitle: string, durationSec: number) {
    // If a previous track was active and wasn't marked complete, record a skip
    if (this.activeTrackId && this.activeTrackId !== trackId && !this.isCompletedRecorded && !this.isSkippedRecorded) {
      this.recordSkip('user_next');
    }

    this.activeTrackId = trackId;
    this.activeTrackTitle = trackTitle;
    this.activeTrackDuration = durationSec || 200;
    this.playbackStartedAt = Date.now();
    this.accumulatedListenedSec = 0;
    this.lastPositionSec = 0;
    this.isCompletedRecorded = false;
    this.isSkippedRecorded = false;

    this.sendEvent({
      trackId,
      eventType: 'START',
      listenedDurationSec: 0,
      trackDurationSec: this.activeTrackDuration
    });
  }

  /**
   * Called periodically during audio playback (e.g., from onTimeUpdate)
   */
  public onTimeUpdate(currentTimeSec: number, totalDurationSec?: number) {
    if (!this.activeTrackId) return;

    if (totalDurationSec && totalDurationSec > 0) {
      this.activeTrackDuration = totalDurationSec;
    }

    // Increment listened duration based on natural forward progression
    const delta = Math.abs(currentTimeSec - this.lastPositionSec);
    if (delta > 0 && delta < 2.5) {
      this.accumulatedListenedSec += delta;
    }
    this.lastPositionSec = currentTimeSec;

    // Check for natural completion (>= 85% of track listened)
    const ratio = this.activeTrackDuration > 0 ? this.accumulatedListenedSec / this.activeTrackDuration : 0;
    if (ratio >= 0.85 && !this.isCompletedRecorded) {
      this.recordCompletion();
    }
  }

  /**
   * Called when track reaches its end
   */
  public onTrackEnded() {
    if (!this.activeTrackId) return;
    if (!this.isCompletedRecorded) {
      this.recordCompletion();
    }
  }

  /**
   * Called when track is looped or replayed
   */
  public onTrackLooped() {
    if (!this.activeTrackId) return;
    this.sendEvent({
      trackId: this.activeTrackId,
      eventType: 'LOOP',
      listenedDurationSec: Math.round(this.accumulatedListenedSec),
      trackDurationSec: this.activeTrackDuration,
      loopCount: 1
    });
  }

  /**
   * Record premature skip
   */
  public recordSkip(reason: 'user_next' | 'user_prev' | 'user_scrub' = 'user_next') {
    if (!this.activeTrackId || this.isSkippedRecorded || this.isCompletedRecorded) return;

    this.isSkippedRecorded = true;
    const listened = Math.round(this.accumulatedListenedSec);
    const pos = Math.round(this.lastPositionSec);

    this.sendEvent({
      trackId: this.activeTrackId,
      eventType: 'SKIP',
      listenedDurationSec: listened,
      trackDurationSec: this.activeTrackDuration,
      skipPositionSec: pos,
      skipReason: reason
    });
  }

  /**
   * Record completion
   */
  private recordCompletion() {
    if (!this.activeTrackId || this.isCompletedRecorded) return;

    this.isCompletedRecorded = true;
    const listened = Math.round(this.accumulatedListenedSec);

    this.sendEvent({
      trackId: this.activeTrackId,
      eventType: 'COMPLETE',
      listenedDurationSec: listened,
      trackDurationSec: this.activeTrackDuration
    });
  }

  /**
   * Dispatch silent telemetry payload to server
   */
  private sendEvent(payload: {
    trackId: string;
    eventType: 'START' | 'PROGRESS' | 'SKIP' | 'COMPLETE' | 'LOOP';
    listenedDurationSec: number;
    trackDurationSec: number;
    skipPositionSec?: number;
    skipReason?: string;
    loopCount?: number;
  }) {
    const user = authClient.getUser();
    const fullPayload = {
      ...payload,
      userId: user?.id || 'default_user',
      timestamp: Date.now(),
      deviceId: 'web-client'
    };

    // Calculate completion %
    const completionPercent = payload.trackDurationSec > 0
      ? Math.min(100, Math.round((payload.listenedDurationSec / payload.trackDurationSec) * 100))
      : 0;

    const logEntry: TelemetryLogEntry = {
      id: `tel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      trackId: payload.trackId,
      trackTitle: this.activeTrackTitle || payload.trackId,
      eventType: payload.eventType,
      listenedDurationSec: payload.listenedDurationSec,
      trackDurationSec: payload.trackDurationSec,
      completionPercent,
      skipReason: payload.skipReason,
      timestamp: Date.now()
    };

    this.recentLogs.unshift(logEntry);
    if (this.recentLogs.length > 50) this.recentLogs.pop();
    this.notifyListeners(logEntry);

    // Non-blocking asynchronous network dispatch
    try {
      fetch('/api/telemetry/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authClient.getAuthHeader()
        },
        body: JSON.stringify(fullPayload),
        keepalive: true
      }).catch(() => {
        // Silently ignore telemetry failure
      });
    } catch {
      // Ignore
    }
  }

  public getRecentLogs(): TelemetryLogEntry[] {
    return [...this.recentLogs];
  }

  public subscribe(cb: TelemetryListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notifyListeners(log: TelemetryLogEntry) {
    this.listeners.forEach((cb) => {
      try {
        cb(log);
      } catch {}
    });
  }
}

export const telemetryClient = new TelemetryClient();
