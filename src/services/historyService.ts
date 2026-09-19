import { Track, HistoryRecord, PlaybackContext } from '../types';
import { areTracksEqual, getSongDeduplicationKey, sanitizeTrackForPersistence } from './musicNormalizationService';

const STORAGE_KEY = 'vd_listening_history_v2';
const LEGACY_STORAGE_KEY = 'vd_playback_history_v1';
const MAX_HISTORY_ITEMS = 150; // Sensible upper bound to prevent runaway local storage growth

class HistoryService {
  private history: HistoryRecord[] = [];
  private listeners: Set<(history: HistoryRecord[]) => void> = new Set();
  private activeSession: {
    trackId: string;
    startTime: number;
    lastRecordedDuration: number;
  } | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.history = parsed.slice(0, MAX_HISTORY_ITEMS);
          return;
        }
      }

      // Legacy fallback migration
      const legacySaved = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacySaved) {
        const legacyTracks: Track[] = JSON.parse(legacySaved);
        if (Array.isArray(legacyTracks)) {
          this.history = legacyTracks.map((track, idx) => ({
            id: `hist-${track.id}-${track.playedAt || Date.now() - idx * 60000}`,
            track,
            playedAt: track.playedAt || (Date.now() - idx * 60000),
            playDurationSec: track.playDurationSec || Math.min(track.durationSec || 200, 180),
            completionPercentage: track.completionPercentage ?? 100,
            context: track.playbackContext || { type: 'all', title: 'Library' },
            playCount: 1
          })).slice(0, MAX_HISTORY_ITEMS);
          this.saveToStorage();
        }
      }
    } catch {
      this.history = [];
    }
  }

  private saveToStorage() {
    try {
      const sanitizedHistory = this.history.map((record) => ({
        ...record,
        track: sanitizeTrackForPersistence(record.track)
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedHistory));
      // Keep legacy key synced with Track array for backward compatibility
      const tracks = this.getHistoryTracks().map((t) => sanitizeTrackForPersistence(t));
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(tracks));
    } catch {}
    this.notify();
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn([...this.history]);
      } catch {}
    });
  }

  public subscribe(fn: (history: HistoryRecord[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Start or register a new playback session for a song
   */
  public recordPlayStart(track: Track, context?: PlaybackContext) {
    if (!track) return;
    const now = Date.now();
    this.activeSession = {
      trackId: track.id,
      startTime: now,
      lastRecordedDuration: 0
    };

    const targetKey = getSongDeduplicationKey(track);
    const existingIndex = this.history.findIndex(
      (entry) => getSongDeduplicationKey(entry.track) === targetKey
    );

    const activeContext = context || track.playbackContext || { type: 'all', title: 'Playback' };

    if (existingIndex >= 0) {
      const existing = this.history[existingIndex];
      const updatedRecord: HistoryRecord = {
        ...existing,
        track: {
          ...track,
          playedAt: now,
          playDurationSec: existing.playDurationSec || 0,
          completionPercentage: existing.completionPercentage ?? 0,
          playbackContext: activeContext
        },
        playedAt: now,
        playCount: (existing.playCount || 1) + 1,
        context: activeContext
      };

      // Move to top (deduplicated)
      this.history.splice(existingIndex, 1);
      this.history.unshift(updatedRecord);
    } else {
      // Create new history record
      const newRecord: HistoryRecord = {
        id: `hist-${track.id}-${now}`,
        track: {
          ...track,
          playedAt: now,
          playDurationSec: 0,
          completionPercentage: 0,
          playbackContext: activeContext
        },
        playedAt: now,
        playDurationSec: 0,
        completionPercentage: 0,
        context: activeContext,
        playCount: 1
      };

      this.history.unshift(newRecord);
      // Sensible cap
      if (this.history.length > MAX_HISTORY_ITEMS) {
        this.history = this.history.slice(0, MAX_HISTORY_ITEMS);
      }
    }

    this.saveToStorage();
  }

  /**
   * Update active listening metrics (duration & completion percentage)
   */
  public recordPlayProgress(
    track: Track,
    durationSec: number,
    totalDurationSec?: number,
    context?: PlaybackContext
  ) {
    if (!track) return;
    const targetKey = getSongDeduplicationKey(track);
    const existingIndex = this.history.findIndex(
      (entry) => getSongDeduplicationKey(entry.track) === targetKey
    );

    const totalDur = totalDurationSec || track.durationSec || 200;
    const completionPct = Math.min(100, Math.max(0, Math.round((durationSec / totalDur) * 100)));
    const activeContext = context || track.playbackContext || { type: 'all', title: 'Playback' };

    if (existingIndex >= 0) {
      const entry = this.history[existingIndex];
      entry.playDurationSec = Math.max(entry.playDurationSec || 0, Math.floor(durationSec));
      entry.completionPercentage = Math.max(entry.completionPercentage || 0, completionPct);
      if (context) {
        entry.context = activeContext;
      }
      entry.track.playDurationSec = entry.playDurationSec;
      entry.track.completionPercentage = entry.completionPercentage;
      entry.track.playbackContext = entry.context;
      
      this.saveToStorage();
    } else {
      this.recordPlayStart(track, activeContext);
    }
  }

  /**
   * Record when a song finishes or gets fully played
   */
  public recordPlayCompleted(track: Track, playedSec?: number, context?: PlaybackContext) {
    if (!track) return;
    const totalDur = track.durationSec || playedSec || 200;
    const actualDuration = playedSec ?? totalDur;
    this.recordPlayProgress(track, actualDuration, totalDur, context);

    const targetKey = getSongDeduplicationKey(track);
    const entry = this.history.find(
      (e) => getSongDeduplicationKey(e.track) === targetKey
    );
    if (entry) {
      entry.completionPercentage = 100;
      entry.track.completionPercentage = 100;
      this.saveToStorage();
    }
  }

  /**
   * Get list of rich HistoryRecord items
   */
  public getHistoryRecords(): HistoryRecord[] {
    return [...this.history];
  }

  /**
   * Get list of Track items enriched with history metadata
   */
  public getHistoryTracks(): Track[] {
    return this.history.map((entry) => ({
      ...entry.track,
      playedAt: entry.playedAt,
      playDurationSec: entry.playDurationSec,
      completionPercentage: entry.completionPercentage,
      playbackContext: entry.context,
      playCount: entry.playCount
    }));
  }

  /**
   * Remove single song entry from history
   */
  public removeEntry(trackId: string) {
    this.history = this.history.filter((entry) => entry.track.id !== trackId);
    this.saveToStorage();
  }

  /**
   * Clear all playback history
   */
  public clearHistory() {
    this.history = [];
    this.saveToStorage();
  }

  /**
   * Calculate detailed analytical statistics from history
   */
  public getAnalytics() {
    const totalTracks = this.history.length;
    let totalListeningSeconds = 0;
    let totalCompletionScore = 0;
    const artistCounts: Record<string, number> = {};
    const genreCounts: Record<string, number> = {};
    const contextCounts: Record<string, number> = {};

    this.history.forEach((entry) => {
      const dur = entry.playDurationSec || entry.track.durationSec || 200;
      totalListeningSeconds += dur;
      totalCompletionScore += (entry.completionPercentage || 50);

      const artist = entry.track.artist.split(/[,&/]/)[0].trim();
      artistCounts[artist] = (artistCounts[artist] || 0) + (entry.playCount || 1);

      if (entry.track.genre) {
        genreCounts[entry.track.genre] = (genreCounts[entry.track.genre] || 0) + (entry.playCount || 1);
      }

      const ctxType = entry.context?.type || 'direct';
      contextCounts[ctxType] = (contextCounts[ctxType] || 0) + 1;
    });

    let topArtist = 'None';
    let maxArtistCount = 0;
    Object.entries(artistCounts).forEach(([art, count]) => {
      if (count > maxArtistCount) {
        maxArtistCount = count;
        topArtist = art;
      }
    });

    let topGenre = 'Diverse';
    let maxGenreCount = 0;
    Object.entries(genreCounts).forEach(([gen, count]) => {
      if (count > maxGenreCount) {
        maxGenreCount = count;
        topGenre = gen;
      }
    });

    const avgCompletion = totalTracks > 0 ? Math.round(totalCompletionScore / totalTracks) : 0;
    const hours = (totalListeningSeconds / 3600).toFixed(1);

    return {
      totalTracks,
      totalListeningSeconds,
      totalHoursFormatted: `${hours} hrs`,
      avgCompletionPercentage: avgCompletion,
      topArtist,
      topGenre,
      contextCounts
    };
  }
}

export const historyService = new HistoryService();
