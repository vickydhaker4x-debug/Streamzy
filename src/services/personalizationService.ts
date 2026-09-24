import {
  Track,
  Album,
  FavoriteItem,
  MusicMix,
  Playlist,
  UserTastePreferences,
  UserSignal,
  UserSignalType,
  TrackScoreBreakdown,
  TrackScoreFactor,
  RecommendationWeights,
  RecommendationScoreBreakdown,
  ScoredTrack,
  RecommendationContext,
  PlaybackContext
} from '../types';
import { TRACKS, RELATED_ALBUMS, FORGOTTEN_FAVORITES } from '../data/musicData';
import { getRelatedTracksFromVideo } from '../utils/pipedApi';
import {
  deduplicateTracks,
  normalizeTrack,
  extractPrimaryArtist,
  detectLanguage,
  areTracksEqual,
  getSongDeduplicationKey
} from './musicNormalizationService';

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  similarityWeight: 25.0,
  artistPreferenceWeight: 20.0,
  genrePreferenceWeight: 15.0,
  languagePreferenceWeight: 10.0,
  popularityWeight: 10.0,
  historyWeight: 15.0,
  likeWeight: 25.0,
  contextWeight: 12.0,
  recentPlayPenaltyWeight: 20.0,
  duplicatePenaltyWeight: 30.0,
  skipPenaltyWeight: 25.0
};

export interface ExtendedTasteProfile {
  lastPlayedTrack: Track | null;
  recentSeeds: Track[];
  favoriteArtists: string[];
  favoriteGenres: string[];
  onboardingCompleted: boolean;
  listens: Record<string, number>;
  skips: Record<string, number>;
  loops: Record<string, number>;
  likes: string[];
  dislikes: string[];
  topArtists: Record<string, number>;
  topGenres: Record<string, number>;
  activeVibe: string;
  artistSkipStreaks: Record<string, number>;
  genreSkipStreaks: Record<string, number>;
  recentSignals: UserSignal[];
  signalCounts: Record<string, number>;
  totalListeningSec: number;
  completedPlaysCount: number;
  immediateSkipsCount: number;
  replaysCount: number;
  searches: string[];
  selectedSongs: Record<string, number>;
  selectedAlbums: Record<string, number>;
  selectedArtists: Record<string, number>;
  selectedPlaylists: Record<string, number>;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export const SIGNAL_WEIGHTS = {
  LIKE: 45, // Strong positive signal
  UNLIKE: -45, // Like removal reversal
  FAVORITE: 40, // Strong positive signal
  UNFAVORITE: -40,
  REPLAY: 35, // Strong positive signal
  PLAY_COMPLETED: 20, // Positive signal (full or >=85% playback)
  PLAY_STARTED: 3, // Base intent signal
  SONG_SELECTED: 15, // Explicit song selection / user intent
  ALBUM_SELECTED: 20, // Explicit album intent
  ARTIST_SELECTED: 25, // Explicit artist intent
  PLAYLIST_SELECTED: 15, // Explicit playlist intent
  SEARCH_MATCH: 12, // User searched for artist/genre/title
  LISTENING_DURATION_RATE: 0.15, // +0.15 pts per active listening second (max +15)
  IMMEDIATE_SKIP_PENALTY: -25, // Skipped in < 15s (Negative signal)
  EARLY_SKIP_PENALTY: -12, // Skipped between 15s and 30s
  REPEATED_SKIP_PENALTY_STEP: -10, // Per consecutive skip on same artist/genre: gradually reduce recommendation weight
} as const;

export interface DynamicHomeSection {
  id: string;
  type: 'quick_picks' | 'continue_listening' | 'because_you_listened' | 'recommended_for_you' | 'mixes' | 'recently_played' | 'similar_to_favorites' | 'trending' | 'new_releases' | 'artists' | 'albums';
  title: string;
  subtitle?: string;
  badge?: string;
  tracks?: Track[];
  mixes?: MusicMix[];
  artists?: {
    id: string;
    name: string;
    avatarUrl: string;
    subscribers?: string;
    monthlyListeners?: string;
    genres: string[];
    topTrack?: Track;
  }[];
  albums?: Album[];
}

export interface PersonalizedHomeData {
  vibeBadge: string;
  radioName: string;
  radioVibe: string;
  sections: DynamicHomeSection[];
  quickPicks: Track[];
  continueListening?: Track[];
  becauseYouListened?: { seed: Track; tracks: Track[] };
  recommendedForYou: Track[];
  similarToFavorites?: Track[];
  curatedMixes: MusicMix[];
  recentlyPlayed?: Track[];
  trendingTracks?: Track[];
  newReleases?: Track[];
  artistRecommendations?: {
    id: string;
    name: string;
    avatarUrl: string;
    subscribers?: string;
    monthlyListeners?: string;
    genres: string[];
    topTrack?: Track;
  }[];
  albumRecommendations?: Album[];
  similarTastes: FavoriteItem[];
  relatedAlbums: Album[];
  listenAgain?: Track[];
  forgottenFavorites?: FavoriteItem[];
  basedOnSection?: {
    title: string;
    subtitle: string;
    tracks: Track[];
  };
}

const STORAGE_KEY = 'vd_music_taste_profile_v2';
const WEIGHTS_STORAGE_KEY = 'vd_recommendation_weights_v2';

/**
 * Smart Vibe & Genre Classifier (supports Bollywood, Punjabi, EDM, Lo-Fi, Pop, Hip-Hop, Indie)
 */
export function detectVibeAndGenre(track: Partial<Track>): { vibe: string; category: string } {
  const text = `${track.title || ''} ${track.artist || ''} ${track.album || ''} ${track.genre || ''}`.toLowerCase();

  // 1. Bollywood & Hindi Romance
  if (
    /arijit|jubin|atif|shreya|pritam|neha|sonu|armaan|sachin|jigar|kesariya|tum hi ho|raataan|channa|apna bana|shayad|agar tum|satranga|bollywood|hindi|romantic|t-series|filmi|soulful/i.test(
      text
    )
  ) {
    return { vibe: 'Bollywood Melody & Romance', category: 'bollywood' };
  }

  // 2. Punjabi & Desi Beats
  if (
    /sidhu|moose|ap dhillon|diljit|karan aujla|shubh|amrit|honey singh|badshah|punjabi|brown munde|elevated|so high|jatt|desihood|cheques|softly/i.test(
      text
    )
  ) {
    return { vibe: 'Punjabi Pop & Urban Beats', category: 'punjabi' };
  }

  // 3. Electronic & Dance / EDM
  if (
    /alan walker|marshmello|chainsmokers|garrix|avicii|goose|synrise|remix|edm|electronic|house|techno|dance|tiesto|guetta|djs|faded/i.test(
      text
    )
  ) {
    return { vibe: 'High-Energy Electronic & EDM', category: 'electronic' };
  }

  // 4. Chill Lo-Fi & Downtempo
  if (
    /emancipator|bonobo|tycho|koresma|tor|lofi|lo-fi|dusk|chill|relax|ambient|study|sleep|downtempo|trip hop|acoustic|sauda|preet/i.test(
      text
    )
  ) {
    return { vibe: 'Midnight Chillout & Lo-Fi', category: 'chillout' };
  }

  // 5. Hip-Hop & Rap / Trap
  if (/drake|eminem|travis|post malone|kendrick|divine|stan|emiway|rap|hip hop|trap|drill|flow/i.test(text)) {
    return { vibe: 'Urban Hip-Hop & Trap', category: 'hiphop' };
  }

  // 6. Global Pop & Hits
  if (
    /the weeknd|taylor swift|ed sheeran|billie eilish|dua lipa|ariana|bieber|starboy|blinding lights|pop|chart/i.test(
      text
    )
  ) {
    return { vibe: 'Global Pop & Trending Hits', category: 'pop' };
  }

  // 7. Indie, Rock & Alternative
  if (/coldplay|imagine dragons|arctic monkeys|queen|nirvana|rock|indie|alternative|acoustic/i.test(text)) {
    return { vibe: 'Indie Atmosphere & Acoustic', category: 'indie' };
  }

  return { vibe: 'Personalized Daily Mix', category: 'eclectic' };
}

/**
 * Item-to-Item Content & Collaborative Filtering Similarity Score
 * Computes context matching across: same artist, same album/era, similar artists, same genre, mood/vibe, and language.
 */
export function calculateTrackSimilarity(a: Track, b: Track): number {
  if (areTracksEqual(a, b)) return 1.0;

  let similarity = 0;
  const primA = extractPrimaryArtist(a.artist).toLowerCase();
  const primB = extractPrimaryArtist(b.artist).toLowerCase();

  // 1. Same Primary Artist Match (30%)
  if (primA === primB) {
    similarity += 0.30;
  } else if (
    a.artist.toLowerCase().includes(primB) ||
    b.artist.toLowerCase().includes(primA)
  ) {
    similarity += 0.20;
  }

  // 2. Similar Artists / Collaborators overlap (15%)
  const relA = new Set((a.relatedArtists || []).map((x) => x.toLowerCase()));
  const relB = new Set((b.relatedArtists || []).map((x) => x.toLowerCase()));
  for (const r of relA) {
    if (relB.has(r) || r === primB || relA.has(primB)) {
      similarity += 0.15;
      break;
    }
  }

  // 3. Same Album & Era (15%)
  const albumA = (a.album || '').trim().toLowerCase();
  const albumB = (b.album || '').trim().toLowerCase();
  if (albumA && albumB && albumA === albumB) {
    similarity += 0.10;
  }
  const yearA = parseInt(a.releaseYear || a.year || '2024', 10);
  const yearB = parseInt(b.releaseYear || b.year || '2024', 10);
  if (Math.abs(yearA - yearB) <= 2) {
    similarity += 0.05;
  } else if (Math.abs(yearA - yearB) <= 6) {
    similarity += 0.02;
  }

  // 4. Same Genre & Vibe Category Match (20%)
  const vibeA = detectVibeAndGenre(a);
  const vibeB = detectVibeAndGenre(b);
  if (vibeA.category === vibeB.category) {
    similarity += 0.20;
  } else if (
    (vibeA.category === 'bollywood' && vibeB.category === 'chillout') ||
    (vibeA.category === 'punjabi' && vibeB.category === 'hiphop') ||
    (vibeA.category === 'electronic' && vibeB.category === 'pop') ||
    (vibeA.category === 'lofi' && vibeB.category === 'chillout')
  ) {
    similarity += 0.10;
  }

  // 5. Similar Mood / Acoustic energy (10%)
  const genreA = (a.genre || '').toLowerCase();
  const genreB = (b.genre || '').toLowerCase();
  if (genreA && genreB && (genreA.includes(genreB) || genreB.includes(genreA))) {
    similarity += 0.10;
  }

  // 6. Language & Cultural Context Match (10%)
  const langA = a.language || detectLanguage(a.title, a.artist, a.genre);
  const langB = b.language || detectLanguage(b.title, b.artist, b.genre);
  if (langA.toLowerCase() === langB.toLowerCase()) {
    similarity += 0.10;
  }

  return Math.min(1.0, similarity);
}

class PersonalizationService {
  private profile: ExtendedTasteProfile;
  private weights: RecommendationWeights;
  private subscribers: Set<() => void> = new Set();
  private lockedLanguage: string | null = null;

  constructor() {
    this.profile = this.loadProfile();
    this.weights = this.loadWeights();
  }

  public getLockedLanguage(): string | null {
    return this.lockedLanguage;
  }

  public setLockedLanguage(lang: string | null): void {
    this.lockedLanguage = lang;
    console.log(`[Personalization] Locked playback language set to: ${lang || 'auto'}`);
  }

  /**
   * Reorganizes and sorts the Up Next queue strictly according to the 3-tier sequence:
   * 1. Singer / Artist (Primary match first, featuring / collaborators second)
   * 2. Genre / Style / Mood of the song
   * 3. Song Language (Preserving same-language continuity until user explicitly searches a new track)
   */
  public prioritizeQueue(
    queueTracks: Track[],
    currentTrack: Track,
    customLockedLanguage?: string | null
  ): Track[] {
    if (!queueTracks || queueTracks.length === 0 || !currentTrack) return queueTracks;

    const seedArtist = extractPrimaryArtist(currentTrack.artist).toLowerCase();
    const fullSeedArtist = (currentTrack.artist || '').toLowerCase();
    const seedVibe = detectVibeAndGenre(currentTrack);
    const seedGenre = (currentTrack.genre || '').toLowerCase();
    const effectiveLang = (
      customLockedLanguage ||
      this.lockedLanguage ||
      currentTrack.language ||
      detectLanguage(currentTrack.title, currentTrack.artist, currentTrack.genre)
    ).toLowerCase();

    // Related artists set
    const seedRelated = new Set((currentTrack.relatedArtists || []).map((a) => a.toLowerCase()));

    // Categorize tracks into priority buckets
    // Tier 1: Exact Primary Artist Match
    // Tier 2: Collaborator / Featuring / Related Artist Match
    // Tier 3: Same Genre / Vibe Match (with same Language)
    // Tier 4: Same Genre / Vibe Match (different Language)
    // Tier 5: Same Language Match
    // Tier 6: Other tracks
    const tiered = queueTracks.map((t) => {
      const tPrimary = extractPrimaryArtist(t.artist).toLowerCase();
      const tFull = (t.artist || '').toLowerCase();
      const tVibe = detectVibeAndGenre(t);
      const tGenre = (t.genre || '').toLowerCase();
      const tLang = (t.language || detectLanguage(t.title, t.artist, t.genre)).toLowerCase();

      const isExactArtist = tPrimary === seedArtist || tFull === fullSeedArtist;
      const isRelatedArtist = !isExactArtist && (
        tFull.includes(seedArtist) ||
        fullSeedArtist.includes(tPrimary) ||
        seedRelated.has(tPrimary) ||
        (t.relatedArtists || []).some((r) => r.toLowerCase() === seedArtist || seedRelated.has(r.toLowerCase()))
      );
      const isSameGenre = (
        tVibe.category === seedVibe.category ||
        (seedGenre && tGenre && (seedGenre.includes(tGenre) || tGenre.includes(seedGenre)))
      );
      const isSameLanguage = tLang === effectiveLang;

      let tier = 6;
      if (isExactArtist) {
        tier = 1;
      } else if (isRelatedArtist) {
        tier = 2;
      } else if (isSameGenre && isSameLanguage) {
        tier = 3;
      } else if (isSameGenre) {
        tier = 4;
      } else if (isSameLanguage) {
        tier = 5;
      } else {
        tier = 6;
      }

      const similarity = calculateTrackSimilarity(currentTrack, t);
      const popularity = t.popularity || 50;

      return {
        track: t,
        tier,
        score: (7 - tier) * 1000 + similarity * 100 + popularity * 0.1
      };
    });

    tiered.sort((a, b) => b.score - a.score);

    return deduplicateTracks(tiered.map((item) => item.track));
  }

  private loadWeights(): RecommendationWeights {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(WEIGHTS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            similarityWeight: typeof parsed.similarityWeight === 'number' ? parsed.similarityWeight : DEFAULT_RECOMMENDATION_WEIGHTS.similarityWeight,
            artistPreferenceWeight: typeof parsed.artistPreferenceWeight === 'number' ? parsed.artistPreferenceWeight : DEFAULT_RECOMMENDATION_WEIGHTS.artistPreferenceWeight,
            genrePreferenceWeight: typeof parsed.genrePreferenceWeight === 'number' ? parsed.genrePreferenceWeight : DEFAULT_RECOMMENDATION_WEIGHTS.genrePreferenceWeight,
            languagePreferenceWeight: typeof parsed.languagePreferenceWeight === 'number' ? parsed.languagePreferenceWeight : DEFAULT_RECOMMENDATION_WEIGHTS.languagePreferenceWeight,
            popularityWeight: typeof parsed.popularityWeight === 'number' ? parsed.popularityWeight : DEFAULT_RECOMMENDATION_WEIGHTS.popularityWeight,
            historyWeight: typeof parsed.historyWeight === 'number' ? parsed.historyWeight : DEFAULT_RECOMMENDATION_WEIGHTS.historyWeight,
            likeWeight: typeof parsed.likeWeight === 'number' ? parsed.likeWeight : DEFAULT_RECOMMENDATION_WEIGHTS.likeWeight,
            contextWeight: typeof parsed.contextWeight === 'number' ? parsed.contextWeight : DEFAULT_RECOMMENDATION_WEIGHTS.contextWeight,
            recentPlayPenaltyWeight: typeof parsed.recentPlayPenaltyWeight === 'number' ? parsed.recentPlayPenaltyWeight : DEFAULT_RECOMMENDATION_WEIGHTS.recentPlayPenaltyWeight,
            duplicatePenaltyWeight: typeof parsed.duplicatePenaltyWeight === 'number' ? parsed.duplicatePenaltyWeight : DEFAULT_RECOMMENDATION_WEIGHTS.duplicatePenaltyWeight,
            skipPenaltyWeight: typeof parsed.skipPenaltyWeight === 'number' ? parsed.skipPenaltyWeight : DEFAULT_RECOMMENDATION_WEIGHTS.skipPenaltyWeight
          };
        }
      } catch {
        // fallback
      }
    }
    return { ...DEFAULT_RECOMMENDATION_WEIGHTS };
  }

  private saveWeights() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(this.weights));
      } catch {
        // ignore
      }
    }
    this.notify();
  }

  public getRecommendationWeights(): RecommendationWeights {
    return { ...this.weights };
  }

  public setRecommendationWeights(newWeights: Partial<RecommendationWeights>): void {
    this.weights = {
      ...this.weights,
      ...newWeights
    };
    this.saveWeights();
  }

  public resetRecommendationWeights(): void {
    this.weights = { ...DEFAULT_RECOMMENDATION_WEIGHTS };
    this.saveWeights();
  }

  private loadProfile(): ExtendedTasteProfile {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            lastPlayedTrack: parsed.lastPlayedTrack || null,
            recentSeeds: parsed.recentSeeds || [],
            favoriteArtists: parsed.favoriteArtists || [],
            favoriteGenres: parsed.favoriteGenres || [],
            onboardingCompleted: Boolean(parsed.onboardingCompleted),
            listens: parsed.listens || {},
            skips: parsed.skips || {},
            loops: parsed.loops || {},
            likes: parsed.likes || [],
            dislikes: parsed.dislikes || [],
            topArtists: parsed.topArtists || {},
            topGenres: parsed.topGenres || {},
            activeVibe: parsed.activeVibe || 'Personalized Mix',
            artistSkipStreaks: parsed.artistSkipStreaks || {},
            genreSkipStreaks: parsed.genreSkipStreaks || {},
            recentSignals: parsed.recentSignals || [],
            signalCounts: parsed.signalCounts || {},
            totalListeningSec: parsed.totalListeningSec || 0,
            completedPlaysCount: parsed.completedPlaysCount || 0,
            immediateSkipsCount: parsed.immediateSkipsCount || 0,
            replaysCount: parsed.replaysCount || 0,
            searches: parsed.searches || [],
            selectedSongs: parsed.selectedSongs || {},
            selectedAlbums: parsed.selectedAlbums || {},
            selectedArtists: parsed.selectedArtists || {},
            selectedPlaylists: parsed.selectedPlaylists || {}
          };
        }
      } catch {
        // ignore
      }
    }

    return {
      lastPlayedTrack: null,
      recentSeeds: [],
      favoriteArtists: [],
      favoriteGenres: [],
      onboardingCompleted: true,
      listens: {},
      skips: {},
      loops: {},
      likes: [],
      dislikes: [],
      topArtists: {},
      topGenres: {},
      activeVibe: 'Personalized Mix',
      artistSkipStreaks: {},
      genreSkipStreaks: {},
      recentSignals: [],
      signalCounts: {},
      totalListeningSec: 0,
      completedPlaysCount: 0,
      immediateSkipsCount: 0,
      replaysCount: 0,
      searches: [],
      selectedSongs: {},
      selectedAlbums: {},
      selectedArtists: {},
      selectedPlaylists: {}
    };
  }

  private saveProfile() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
      } catch {
        // ignore
      }
    }
    this.notify();
  }

  public subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify() {
    this.subscribers.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  }

  public getProfile(): ExtendedTasteProfile {
    return this.profile;
  }

  public isColdStartCompleted(): boolean {
    return true;
  }

  /**
   * Save Cold Start Onboarding preferences (favorite genres & artists)
   */
  public saveColdStartPreferences(genres: string[], artists: string[]) {
    this.profile.favoriteGenres = genres;
    this.profile.favoriteArtists = artists;
    this.profile.onboardingCompleted = true;

    // Seed initial affinities
    artists.forEach((art) => {
      this.profile.topArtists[art] = (this.profile.topArtists[art] || 0) + 15;
    });

    genres.forEach((genre) => {
      const cat = genre.toLowerCase().replace(/[^a-z]/g, '');
      this.profile.topGenres[cat] = (this.profile.topGenres[cat] || 0) + 12;
    });

    this.saveProfile();
  }

  /**
   * Universal Signal Logger
   * Appends to recentSignals stream, updates signal counters, and calculates point delta
   */
  public recordSignal(
    signalData: Omit<UserSignal, 'id' | 'timestamp'> & { timestamp?: number }
  ): UserSignal {
    const signal: UserSignal = {
      ...signalData,
      id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: signalData.timestamp || Date.now()
    };

    // Update signal counter
    this.profile.signalCounts[signal.type] = (this.profile.signalCounts[signal.type] || 0) + 1;

    // Append to recent signals (keep last 50 for transparent audit trail)
    this.profile.recentSignals.unshift(signal);
    if (this.profile.recentSignals.length > 50) {
      this.profile.recentSignals.pop();
    }

    return signal;
  }

  /**
   * Helper for unified track listen event with vibe extraction
   */
  public recordTrackListen(track: Track): { vibe: string; seedTracks: Track[] } {
    this.recordPlayStarted(track, 'user_action');
    const { vibe } = detectVibeAndGenre(track);
    return { vibe, seedTracks: this.profile.recentSeeds };
  }

  /**
   * 1. SIGNAL: Play Started
   * Triggered whenever playback begins
   */
  public recordPlayStarted(track: Track, context = 'default'): void {
    const { vibe, category } = detectVibeAndGenre(track);
    this.profile.lastPlayedTrack = track;
    this.profile.activeVibe = vibe;

    // Track play count
    this.profile.listens[track.id] = (this.profile.listens[track.id] || 0) + 1;

    // Maintain recent seeds (last 8 tracks)
    const existingIndex = this.profile.recentSeeds.findIndex((t) => t.id === track.id || t.title === track.title);
    if (existingIndex !== -1) {
      this.profile.recentSeeds.splice(existingIndex, 1);
    }
    this.profile.recentSeeds.unshift(track);
    if (this.profile.recentSeeds.length > 8) {
      this.profile.recentSeeds.pop();
    }

    // Artist & Genre base affinity
    if (track.artist) {
      this.profile.topArtists[track.artist] = (this.profile.topArtists[track.artist] || 0) + 2;
    }
    this.profile.topGenres[category] = (this.profile.topGenres[category] || 0) + 2;

    this.recordSignal({
      type: 'play_started',
      trackId: track.id,
      trackTitle: track.title,
      artist: track.artist,
      genre: category,
      album: track.album,
      weightDelta: SIGNAL_WEIGHTS.PLAY_STARTED,
      description: `Started playback in ${context}`
    });

    this.saveProfile();
  }

  /**
   * 2. SIGNAL: Play Completed (Positive Signal)
   * Triggered when song plays to natural end or >= 85% duration
   */
  public recordPlayCompleted(track: Track, durationSec = 0): void {
    const { category } = detectVibeAndGenre(track);
    this.profile.completedPlaysCount += 1;

    // Reward artist and genre
    if (track.artist) {
      this.profile.topArtists[track.artist] = (this.profile.topArtists[track.artist] || 0) + 5;
      // Reset skip streak on completion
      this.profile.artistSkipStreaks[track.artist] = 0;
    }
    this.profile.topGenres[category] = (this.profile.topGenres[category] || 0) + 4;
    this.profile.genreSkipStreaks[category] = 0;

    this.recordSignal({
      type: 'play_completed',
      trackId: track.id,
      trackTitle: track.title,
      artist: track.artist,
      genre: category,
      album: track.album,
      listenedSec: durationSec,
      totalDurationSec: track.durationSec,
      completionRatio: 1.0,
      weightDelta: SIGNAL_WEIGHTS.PLAY_COMPLETED,
      description: `Completed full track (${durationSec > 0 ? Math.round(durationSec) + 's' : '100%'})`
    });

    this.saveProfile();
  }

  /**
   * 3. SIGNAL: Skip (Immediate vs Early)
   * - Immediate skip (< 15s): Strong negative signal (-25 pts), increases artist/genre skip streak
   * - Early skip (15-30s): Mild negative signal (-12 pts)
   * - Repeated skips for same artist/genre: gradually reduce recommendation weight
   */
  public recordTrackSkip(track: Track, secondsBeforeSkip: number, totalDurationSec = 0): void {
    const { category } = detectVibeAndGenre(track);
    const isImmediate = secondsBeforeSkip < 15;
    const isEarly = secondsBeforeSkip >= 15 && secondsBeforeSkip < 30;

    if (!isImmediate && !isEarly) {
      // User listened past 30s before moving on: reset skip streaks
      if (track.artist) this.profile.artistSkipStreaks[track.artist] = 0;
      this.profile.genreSkipStreaks[category] = 0;
      return;
    }

    this.profile.skips[track.id] = (this.profile.skips[track.id] || 0) + 1;

    if (isImmediate) {
      this.profile.immediateSkipsCount += 1;

      // Increment consecutive skip streaks for artist and genre
      if (track.artist) {
        const currentStreak = (this.profile.artistSkipStreaks[track.artist] || 0) + 1;
        this.profile.artistSkipStreaks[track.artist] = currentStreak;

        // Reduce artist affinity proportionally
        const penalty = 3 + (currentStreak * 2);
        this.profile.topArtists[track.artist] = Math.max(0, (this.profile.topArtists[track.artist] || 0) - penalty);
      }

      const currentGenreStreak = (this.profile.genreSkipStreaks[category] || 0) + 1;
      this.profile.genreSkipStreaks[category] = currentGenreStreak;
      this.profile.topGenres[category] = Math.max(0, (this.profile.topGenres[category] || 0) - (2 + currentGenreStreak));

      this.recordSignal({
        type: 'skip',
        trackId: track.id,
        trackTitle: track.title,
        artist: track.artist,
        genre: category,
        listenedSec: Math.round(secondsBeforeSkip),
        totalDurationSec: totalDurationSec || track.durationSec,
        isImmediateSkip: true,
        weightDelta: SIGNAL_WEIGHTS.IMMEDIATE_SKIP_PENALTY,
        description: `Immediate skip after ${Math.round(secondsBeforeSkip)}s (Artist skip streak: ${this.profile.artistSkipStreaks[track.artist || ''] || 1})`
      });
    } else {
      // Early skip (15-30s)
      if (track.artist && this.profile.topArtists[track.artist]) {
        this.profile.topArtists[track.artist] = Math.max(0, this.profile.topArtists[track.artist] - 1);
      }

      this.recordSignal({
        type: 'skip',
        trackId: track.id,
        trackTitle: track.title,
        artist: track.artist,
        genre: category,
        listenedSec: Math.round(secondsBeforeSkip),
        totalDurationSec: totalDurationSec || track.durationSec,
        isImmediateSkip: false,
        weightDelta: SIGNAL_WEIGHTS.EARLY_SKIP_PENALTY,
        description: `Early skip after ${Math.round(secondsBeforeSkip)}s`
      });
    }

    this.saveProfile();
  }

  /**
   * 4. SIGNAL: Replay / Loop (Strong Positive Signal)
   * User re-plays the same song or engages repeat-one
   */
  public recordTrackLoop(track: Track): void {
    const { category } = detectVibeAndGenre(track);
    this.profile.loops[track.id] = (this.profile.loops[track.id] || 0) + 1;
    this.profile.replaysCount += 1;

    if (track.artist) {
      this.profile.topArtists[track.artist] = (this.profile.topArtists[track.artist] || 0) + 6;
      this.profile.artistSkipStreaks[track.artist] = 0; // Clear any skip penalties
    }
    this.profile.topGenres[category] = (this.profile.topGenres[category] || 0) + 4;
    this.profile.genreSkipStreaks[category] = 0;

    this.recordSignal({
      type: 'replay',
      trackId: track.id,
      trackTitle: track.title,
      artist: track.artist,
      genre: category,
      album: track.album,
      weightDelta: SIGNAL_WEIGHTS.REPLAY,
      description: `Replayed / Looped track (${this.profile.loops[track.id]}x)`
    });

    this.saveProfile();
  }

  /**
   * 5. SIGNAL: Like / Unlike / Favorite (Strong Positive / Reversal)
   */
  public toggleLike(trackId: string, isFav?: boolean): boolean {
    const track = TRACKS.find((t) => t.id === trackId);
    const isCurrentlyLiked = this.profile.likes.includes(trackId);
    const shouldLike = isFav !== undefined ? isFav : !isCurrentlyLiked;

    if (!shouldLike) {
      this.profile.likes = this.profile.likes.filter((id) => id !== trackId);

      this.recordSignal({
        type: 'unlike',
        trackId,
        trackTitle: track?.title || trackId,
        artist: track?.artist,
        weightDelta: SIGNAL_WEIGHTS.UNLIKE,
        description: 'Removed from liked songs'
      });
      this.saveProfile();
      return false;
    } else {
      if (!this.profile.likes.includes(trackId)) {
        this.profile.likes.push(trackId);
      }
      this.profile.dislikes = this.profile.dislikes.filter((id) => id !== trackId);

      if (track?.artist) {
        this.profile.topArtists[track.artist] = (this.profile.topArtists[track.artist] || 0) + 8;
        this.profile.artistSkipStreaks[track.artist] = 0;
      }
      if (track) {
        const { category } = detectVibeAndGenre(track);
        this.profile.topGenres[category] = (this.profile.topGenres[category] || 0) + 6;
      }

      this.recordSignal({
        type: 'like',
        trackId,
        trackTitle: track?.title || trackId,
        artist: track?.artist,
        weightDelta: SIGNAL_WEIGHTS.LIKE,
        description: 'Liked song (Strong positive signal)'
      });
      this.saveProfile();
      return true;
    }
  }

  /**
   * 6. SIGNAL: Favorite action
   */
  public toggleFavorite(track: Track | string, isFav?: boolean): void {
    const trackId = typeof track === 'string' ? track : track.id;
    const tr = typeof track === 'string' ? TRACKS.find((t) => t.id === trackId) : track;
    this.toggleLike(trackId, isFav);
  }

  /**
   * 7. SIGNAL: Dislike
   */
  public toggleDislike(trackId: string): boolean {
    const isCurrentlyDisliked = this.profile.dislikes.includes(trackId);
    const track = TRACKS.find((t) => t.id === trackId);

    if (isCurrentlyDisliked) {
      this.profile.dislikes = this.profile.dislikes.filter((id) => id !== trackId);
    } else {
      this.profile.dislikes.push(trackId);
      this.profile.likes = this.profile.likes.filter((id) => id !== trackId);

      if (track?.artist && this.profile.topArtists[track.artist]) {
        this.profile.topArtists[track.artist] = Math.max(0, this.profile.topArtists[track.artist] - 10);
      }
    }

    this.saveProfile();
    return !isCurrentlyDisliked;
  }

  /**
   * 8. SIGNAL: Search (Query intent mapping)
   * Matches user search query to artists, genres, or keywords
   */
  public recordSearch(query: string, matchedTracks: Track[] = []): void {
    const clean = query.trim();
    if (!clean) return;

    if (!this.profile.searches.includes(clean)) {
      this.profile.searches.unshift(clean);
      if (this.profile.searches.length > 20) this.profile.searches.pop();
    }

    const cleanLower = clean.toLowerCase();

    // Check if search matches any catalog artists or genres
    TRACKS.forEach((t) => {
      const art = t.artist.toLowerCase();
      if (art && (cleanLower.includes(art) || art.includes(cleanLower))) {
        this.profile.topArtists[t.artist] = (this.profile.topArtists[t.artist] || 0) + 3;
      }
      const { category } = detectVibeAndGenre(t);
      if (cleanLower.includes(category)) {
        this.profile.topGenres[category] = (this.profile.topGenres[category] || 0) + 3;
      }
    });

    this.recordSignal({
      type: 'search',
      searchQuery: clean,
      weightDelta: SIGNAL_WEIGHTS.SEARCH_MATCH,
      description: `Searched for "${clean}" (${matchedTracks.length} matches)`
    });

    this.saveProfile();
  }

  /**
   * 9. SIGNAL: Song Selected (Explicit User Intent)
   */
  public recordSongSelected(track: Track, source = 'user_click'): void {
    this.profile.selectedSongs[track.id] = (this.profile.selectedSongs[track.id] || 0) + 1;

    if (track.artist) {
      this.profile.topArtists[track.artist] = (this.profile.topArtists[track.artist] || 0) + 3;
      this.profile.artistSkipStreaks[track.artist] = 0;
    }
    const { category } = detectVibeAndGenre(track);
    this.profile.topGenres[category] = (this.profile.topGenres[category] || 0) + 2;

    this.recordSignal({
      type: 'song_selected',
      trackId: track.id,
      trackTitle: track.title,
      artist: track.artist,
      genre: category,
      weightDelta: SIGNAL_WEIGHTS.SONG_SELECTED,
      description: `Directly selected song via ${source}`
    });

    this.saveProfile();
  }

  /**
   * 10. SIGNAL: Album Selected
   */
  public recordAlbumSelected(album: Album | string, artistName?: string, genreName?: string): void {
    const title = typeof album === 'string' ? album : album.title;
    const artist = typeof album === 'string' ? artistName : album.artist;

    this.profile.selectedAlbums[title] = (this.profile.selectedAlbums[title] || 0) + 1;

    if (artist) {
      this.profile.topArtists[artist] = (this.profile.topArtists[artist] || 0) + 4;
      this.profile.artistSkipStreaks[artist] = 0;
    }

    this.recordSignal({
      type: 'album_selected',
      album: title,
      artist: artist || '',
      genre: genreName,
      weightDelta: SIGNAL_WEIGHTS.ALBUM_SELECTED,
      description: `Explored album "${title}"`
    });

    this.saveProfile();
  }

  /**
   * 11. SIGNAL: Artist Selected
   */
  public recordArtistSelected(artist: string, genreName?: string): void {
    const name = artist.trim();
    if (!name) return;

    this.profile.selectedArtists[name] = (this.profile.selectedArtists[name] || 0) + 1;
    this.profile.topArtists[name] = (this.profile.topArtists[name] || 0) + 6;
    this.profile.artistSkipStreaks[name] = 0; // Reset skip streak when user proactively clicks artist

    this.recordSignal({
      type: 'artist_selected',
      artist: name,
      genre: genreName,
      weightDelta: SIGNAL_WEIGHTS.ARTIST_SELECTED,
      description: `Explored artist profile "${name}"`
    });

    this.saveProfile();
  }

  /**
   * 12. SIGNAL: Playlist / Mix Selected
   */
  public recordPlaylistSelected(playlist: Playlist | MusicMix | string, tracks: Track[] = []): void {
    const name = typeof playlist === 'string' 
      ? playlist 
      : ('title' in playlist ? (playlist as MusicMix).title : (playlist as Playlist).name) || 'Playlist';
    const id = typeof playlist === 'string' ? playlist : playlist.id;

    this.profile.selectedPlaylists[id] = (this.profile.selectedPlaylists[id] || 0) + 1;

    // Give slight affinity to included tracks
    tracks.slice(0, 5).forEach((t) => {
      if (t.artist) this.profile.topArtists[t.artist] = (this.profile.topArtists[t.artist] || 0) + 1;
    });

    this.recordSignal({
      type: 'playlist_selected',
      playlistId: id,
      playlistTitle: name,
      weightDelta: SIGNAL_WEIGHTS.PLAYLIST_SELECTED,
      description: `Selected playlist "${name}"`
    });

    this.saveProfile();
  }

  /**
   * 13. SIGNAL: Listening Duration Tracker
   */
  public recordListeningDuration(track: Track, durationSec: number): void {
    if (durationSec <= 0) return;
    this.profile.totalListeningSec += durationSec;

    // Reset skip streaks if played >= 45s
    if (durationSec >= 45) {
      if (track.artist) this.profile.artistSkipStreaks[track.artist] = 0;
      const { category } = detectVibeAndGenre(track);
      this.profile.genreSkipStreaks[category] = 0;
    }

    this.saveProfile();
  }

  /**
   * Helper to detect user's top played languages for linguistic affinity scoring
   */
  public detectUserTopLanguages(): string[] {
    const langCounts: Record<string, number> = {};
    for (const [id, count] of Object.entries(this.profile.listens)) {
      const trk = TRACKS.find((t) => t.id === id);
      if (trk) {
        const l = trk.language || detectLanguage(trk.title, trk.artist, trk.genre);
        langCounts[l] = (langCounts[l] || 0) + count;
      }
    }
    const sorted = Object.entries(langCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([l]) => l);
    return sorted.length > 0 ? sorted : ['hindi', 'punjabi', 'english'];
  }

  /**
   * 11. CENTRALIZED RECOMMENDATION SCORING ENGINE
   * 
   * recommendationScore =
   *     similarityScore
   *   + artistPreferenceScore
   *   + genrePreferenceScore
   *   + languagePreferenceScore
   *   + popularityScore
   *   + historyScore
   *   + likeScore
   *   + contextScore
   *   - recentPlayPenalty
   *   - duplicatePenalty
   *   - skipPenalty
   *
   * All weights are configurable, transparent, and normalized.
   */
  public calculateRecommendationScore(
    track: Track,
    context: RecommendationContext = {}
  ): RecommendationScoreBreakdown {
    const id = track.id;
    const factors: TrackScoreFactor[] = [];
    const weights = this.weights;

    // Disliked check (Hard filter / disqualification)
    if (this.profile.dislikes.includes(id)) {
      return {
        trackId: id,
        trackTitle: track.title,
        artist: track.artist,
        genre: track.genre,
        similarityScore: 0,
        artistPreferenceScore: 0,
        genrePreferenceScore: 0,
        languagePreferenceScore: 0,
        popularityScore: 0,
        historyScore: 0,
        likeScore: 0,
        contextScore: 0,
        recentPlayPenalty: 0,
        duplicatePenalty: 0,
        skipPenalty: 1000,
        rawScore: -1000,
        totalScore: -1000,
        recommendationScore: -1000,
        normalizedScore: 0,
        factors: [
          {
            name: 'Disliked Song',
            points: -1000,
            type: 'negative',
            description: 'Explicitly marked thumbs-down by user'
          }
        ],
        weights: { ...weights }
      };
    }

    // 1. SIMILARITY SCORE
    let simRatio = 0.5;
    const seedTrack =
      context.seedTrack ||
      this.profile.lastPlayedTrack ||
      (this.profile.recentSeeds.length > 0 ? this.profile.recentSeeds[0] : null);

    if (seedTrack && seedTrack.id !== track.id) {
      simRatio = calculateTrackSimilarity(seedTrack, track);
    } else if (this.profile.recentSeeds.length > 0) {
      const topSims = this.profile.recentSeeds
        .slice(0, 3)
        .map((s) => calculateTrackSimilarity(s, track));
      simRatio = Math.max(...topSims, 0.4);
    }
    const similarityScore = Math.round(simRatio * weights.similarityWeight * 10) / 10;
    factors.push({
      name: `Similarity Score (${Math.round(simRatio * 100)}% match)`,
      points: Math.round(similarityScore),
      type: 'positive',
      description: seedTrack
        ? `Acoustic, metadata & vibe similarity to "${seedTrack.title}"`
        : 'Similarity to recent listening seeds'
    });

    // 2. ARTIST PREFERENCE SCORE
    const artistLower = (track.artist || '').toLowerCase();
    const isFavArtist = this.profile.favoriteArtists.some(
      (a) => artistLower.includes(a.toLowerCase()) || a.toLowerCase().includes(artistLower)
    );
    const artistListenCount = (track.artist && this.profile.topArtists[track.artist]) || 0;
    const artistSelectCount = (track.artist && this.profile.selectedArtists[track.artist]) || 0;
    const artAffinityRatio = Math.min(
      1.0,
      (isFavArtist ? 0.6 : 0) +
        Math.min(artistListenCount / 15, 0.6) +
        Math.min(artistSelectCount / 4, 0.4)
    );
    const artistPreferenceScore = Math.round(artAffinityRatio * weights.artistPreferenceWeight * 10) / 10;
    if (artistPreferenceScore > 0) {
      factors.push({
        name: `Artist Preference (${track.artist})`,
        points: Math.round(artistPreferenceScore),
        type: 'positive',
        description: 'Calculated artist affinity from listening habits and selections'
      });
    }

    // 3. GENRE PREFERENCE SCORE
    const { category } = detectVibeAndGenre(track);
    const isFavGenre = this.profile.favoriteGenres.some((g) => {
      const gClean = g.toLowerCase();
      return gClean.includes(category) || category.includes(gClean);
    });
    const genreListenCount = this.profile.topGenres[category] || 0;
    const genAffinityRatio = Math.min(
      1.0,
      (isFavGenre ? 0.6 : 0) + Math.min(genreListenCount / 15, 0.6)
    );
    const genrePreferenceScore = Math.round(genAffinityRatio * weights.genrePreferenceWeight * 10) / 10;
    if (genrePreferenceScore > 0) {
      factors.push({
        name: `Genre Preference (${category})`,
        points: Math.round(genrePreferenceScore),
        type: 'positive',
        description: `Preference for ${category} category and acoustic profile`
      });
    }

    // 4. LANGUAGE PREFERENCE SCORE
    const trackLang = (track.language || detectLanguage(track.title, track.artist, track.genre)).toLowerCase();
    const userLangs = context.preferredLanguages || this.detectUserTopLanguages();
    const isPrimaryLang = userLangs.length > 0 && userLangs[0].toLowerCase() === trackLang;
    const isKnownLang = userLangs.some((l) => l.toLowerCase() === trackLang);
    const langRatio = isPrimaryLang ? 1.0 : isKnownLang ? 0.75 : 0.4;
    const languagePreferenceScore = Math.round(langRatio * weights.languagePreferenceWeight * 10) / 10;
    factors.push({
      name: `Language Alignment (${trackLang.toUpperCase()})`,
      points: Math.round(languagePreferenceScore),
      type: 'positive',
      description: 'Linguistic and cultural catalog match'
    });

    // 5. POPULARITY SCORE
    const popRatio = this.parsePopularityScore(track.plays, track.popularity || 50) / 100;
    const popularityScore = Math.round(popRatio * weights.popularityWeight * 10) / 10;
    factors.push({
      name: 'Catalog Popularity Baseline',
      points: Math.round(popularityScore),
      type: 'neutral',
      description: 'Global streaming volume and popularity'
    });

    // 6. HISTORY SCORE
    const listens = this.profile.listens[id] || 0;
    const loops = this.profile.loops[id] || 0;
    const selections = this.profile.selectedSongs[id] || 0;
    const historyRatio = Math.min(
      1.0,
      Math.min(listens / 10, 0.5) + Math.min(loops / 3, 0.5) + Math.min(selections / 3, 0.3)
    );
    const historyScore = Math.round(historyRatio * weights.historyWeight * 10) / 10;
    if (historyScore > 0) {
      factors.push({
        name: `History & Replays (${listens} plays, ${loops} loops)`,
        points: Math.round(historyScore),
        type: 'positive',
        description: 'Prior listening frequency, replays, and proactive song taps'
      });
    }

    // 7. LIKE SCORE
    const isLiked = this.profile.likes.includes(id) || Boolean(track.isFavorite);
    const likeScore = isLiked ? weights.likeWeight : 0;
    if (isLiked) {
      factors.push({
        name: 'Liked / Favorite Track',
        points: Math.round(likeScore),
        type: 'positive',
        description: 'Strong positive signal from explicit user like / favorite'
      });
    }

    // 8. CONTEXT SCORE (Time-of-day, vibe, recent searches)
    const hour = context.timeOfDay ? (context.timeOfDay === 'morning' ? 8 : context.timeOfDay === 'afternoon' ? 14 : context.timeOfDay === 'evening' ? 19 : 23) : new Date().getHours();
    let timeMatchRatio = 0.5;
    if (hour >= 5 && hour < 12) {
      if (category === 'chillout' || category === 'bollywood' || category === 'pop') timeMatchRatio = 0.9;
    } else if (hour >= 12 && hour < 17) {
      if (category === 'pop' || category === 'hiphop' || category === 'punjabi') timeMatchRatio = 0.9;
    } else if (hour >= 17 && hour < 22) {
      if (category === 'bollywood' || category === 'chillout' || category === 'indie') timeMatchRatio = 1.0;
    } else {
      if (category === 'chillout' || category === 'electronic') timeMatchRatio = 1.0;
    }

    const trackText = `${track.title} ${track.artist} ${track.genre || ''}`.toLowerCase();
    const hasSearchMatch = this.profile.searches.slice(0, 5).some((q) => trackText.includes(q.toLowerCase()));
    const searchMatchRatio = hasSearchMatch ? 0.5 : 0;
    const contextRatio = Math.min(1.0, (timeMatchRatio * 0.7) + searchMatchRatio);
    const contextScore = Math.round(contextRatio * weights.contextWeight * 10) / 10;
    if (contextScore > 0) {
      factors.push({
        name: 'Context & Time Alignment',
        points: Math.round(contextScore),
        type: 'positive',
        description: hasSearchMatch
          ? 'Aligned with recent search terms and current time-of-day vibe'
          : 'Contextual bonus matching current hour vibe'
      });
    }

    // 9. RECENT PLAY PENALTY
    let recentRatio = 0;
    if (context.recentHistory && context.recentHistory.length > 0) {
      const idx = context.recentHistory.findIndex((t) => t.id === id || areTracksEqual(t, track));
      if (idx !== -1) {
        if (idx === 0) recentRatio = 1.0;
        else if (idx < 3) recentRatio = 0.8;
        else if (idx < 7) recentRatio = 0.5;
        else if (idx < 12) recentRatio = 0.25;
      }
    } else if (this.profile.lastPlayedTrack && areTracksEqual(this.profile.lastPlayedTrack, track)) {
      recentRatio = 0.9;
    }
    const recentPlayPenalty = Math.round(recentRatio * weights.recentPlayPenaltyWeight * 10) / 10;
    if (recentPlayPenalty > 0) {
      factors.push({
        name: 'Recent Play Cooldown Penalty',
        points: -Math.round(recentPlayPenalty),
        type: 'negative',
        description: 'Recently played; cooling down to ensure playlist variety'
      });
    }

    // 10. DUPLICATE PENALTY
    let dupRatio = 0;
    if (context.excludedTrackIds && context.excludedTrackIds.includes(id)) {
      dupRatio = 1.0;
    } else if (context.usedTrackKeys) {
      const key = getSongDeduplicationKey(track);
      if (context.usedTrackKeys.has(key)) {
        dupRatio = 1.0;
      }
    } else if (context.currentQueue && context.currentQueue.some((q) => q.id === id || areTracksEqual(q, track))) {
      dupRatio = 0.7;
    }
    const duplicatePenalty = Math.round(dupRatio * weights.duplicatePenaltyWeight * 10) / 10;
    if (duplicatePenalty > 0) {
      factors.push({
        name: 'Duplicate Track Penalty',
        points: -Math.round(duplicatePenalty),
        type: 'negative',
        description: 'Already queued or present in section'
      });
    }

    // 11. SKIP PENALTY (Direct skips + artist & genre fatigue streaks)
    const directSkips = this.profile.skips[id] || 0;
    const artistStreak = (track.artist && this.profile.artistSkipStreaks[track.artist]) || 0;
    const genreStreak = this.profile.genreSkipStreaks[category] || 0;
    const skipRatio = Math.min(
      2.0,
      Math.min(directSkips * 0.35, 0.8) +
        (artistStreak >= 2 ? Math.min((artistStreak - 1) * 0.35, 0.8) : 0) +
        (genreStreak >= 2 ? Math.min((genreStreak - 1) * 0.25, 0.5) : 0)
    );
    const skipPenalty = Math.round(skipRatio * weights.skipPenaltyWeight * 10) / 10;
    if (skipPenalty > 0) {
      factors.push({
        name: `Skip Penalty & Fatigue (${directSkips} direct skips${artistStreak >= 2 ? `, ${artistStreak}x artist skip streak` : ''})`,
        points: -Math.round(skipPenalty),
        type: 'negative',
        description: 'Repeated skips reduce recommendation priority'
      });
    }

    // TOTAL RECOMMENDATION SCORE CALCULATION
    const rawScore =
      similarityScore +
      artistPreferenceScore +
      genrePreferenceScore +
      languagePreferenceScore +
      popularityScore +
      historyScore +
      likeScore +
      contextScore -
      recentPlayPenalty -
      duplicatePenalty -
      skipPenalty;

    const maxTheoreticalScore =
      (weights.similarityWeight +
        weights.artistPreferenceWeight +
        weights.genrePreferenceWeight +
        weights.languagePreferenceWeight +
        weights.popularityWeight +
        weights.historyWeight +
        weights.likeWeight +
        weights.contextWeight) ||
      100;

    const normalizedScore = Math.max(
      0,
      Math.min(100, Math.round((Math.max(0, rawScore) / maxTheoreticalScore) * 100))
    );

    return {
      trackId: id,
      trackTitle: track.title,
      artist: track.artist,
      genre: category,
      similarityScore,
      artistPreferenceScore,
      genrePreferenceScore,
      languagePreferenceScore,
      popularityScore,
      historyScore,
      likeScore,
      contextScore,
      recentPlayPenalty,
      duplicatePenalty,
      skipPenalty,
      rawScore: Math.round(rawScore * 10) / 10,
      totalScore: Math.round(rawScore),
      recommendationScore: Math.round(rawScore * 10) / 10,
      normalizedScore,
      factors,
      weights: { ...weights }
    };
  }

  /**
   * Centralized Batch Scoring and Ranking Function
   * Ranks candidates using the unified recommendation scoring engine.
   */
  public scoreAndRankCandidates(
    candidates: Track[],
    context: RecommendationContext = {}
  ): ScoredTrack[] {
    const scoredList: ScoredTrack[] = candidates.map((track) => {
      const breakdown = this.calculateRecommendationScore(track, context);
      return {
        track,
        score: breakdown.normalizedScore,
        rawScore: breakdown.rawScore ?? breakdown.rawRecommendationScore ?? 0,
        recommendationScore: breakdown.recommendationScore ?? breakdown.rawScore ?? 0,
        normalizedScore: breakdown.normalizedScore,
        breakdown
      };
    });

    // Rank descending by recommendationScore
    return scoredList.sort((a, b) => (b.recommendationScore ?? 0) - (a.recommendationScore ?? 0));
  }

  /**
   * Complete Transparent Track Score Breakdown for UI Inspection
   * Backwards-compatible adapter for legacy consumers while routing to the centralized engine.
   */
  public getTrackScoreBreakdown(track: Track): TrackScoreBreakdown {
    const breakdown = this.calculateRecommendationScore(track);
    return {
      trackId: breakdown.trackId,
      trackTitle: breakdown.trackTitle,
      artist: breakdown.artist,
      genre: breakdown.genre,
      totalScore: breakdown.totalScore,
      factors: breakdown.factors,
      artistAffinity: Math.round(breakdown.artistPreferenceScore),
      genreAffinity: Math.round(breakdown.genrePreferenceScore),
      skipPenalty: Math.round(breakdown.skipPenalty),
      repeatedSkipPenalty: 0,
      likeBonus: Math.round(breakdown.likeScore),
      replayBonus: 0,
      completionBonus: Math.round(breakdown.historyScore),
      selectionBonus: 0,
      durationBonus: 0,
      searchBonus: Math.round(breakdown.contextScore)
    };
  }

  /**
   * Calculate exact transparent user affinity score for a track
   */
  public calculateTrackAffinity(track: Track): number {
    return this.calculateRecommendationScore(track).totalScore;
  }

  /**
   * Get recent recorded signals
   */
  public getRecentSignals(limit = 30): UserSignal[] {
    return this.profile.recentSignals.slice(0, limit);
  }

  /**
   * Get Taste Summary & Preferences
   */
  public getTasteSummary() {
    const topArtistsSorted = Object.entries(this.profile.topArtists)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, score]) => ({
        name,
        score,
        skipStreak: this.profile.artistSkipStreaks[name] || 0
      }));

    const topGenresSorted = Object.entries(this.profile.topGenres)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([genre, score]) => ({
        genre,
        score,
        skipStreak: this.profile.genreSkipStreaks[genre] || 0
      }));

    return {
      totalListens: Object.values(this.profile.listens).reduce((a, b) => a + b, 0),
      totalLikes: this.profile.likes.length,
      totalDislikes: this.profile.dislikes.length,
      totalReplays: this.profile.replaysCount,
      completedPlays: this.profile.completedPlaysCount,
      immediateSkips: this.profile.immediateSkipsCount,
      totalListeningSec: this.profile.totalListeningSec,
      topArtists: topArtistsSorted,
      topGenres: topGenresSorted,
      activeVibe: this.profile.activeVibe,
      recentSignals: this.profile.recentSignals.slice(0, 20)
    };
  }

  /**
   * Reset taste profile to clean state
   */
  public resetTasteProfile(): void {
    this.profile = {
      lastPlayedTrack: null,
      recentSeeds: [],
      favoriteArtists: [],
      favoriteGenres: [],
      onboardingCompleted: true,
      listens: {},
      skips: {},
      loops: {},
      likes: [],
      dislikes: [],
      topArtists: {},
      topGenres: {},
      activeVibe: 'Personalized Mix',
      artistSkipStreaks: {},
      genreSkipStreaks: {},
      recentSignals: [],
      signalCounts: {},
      totalListeningSec: 0,
      completedPlaysCount: 0,
      immediateSkipsCount: 0,
      replaysCount: 0,
      searches: [],
      selectedSongs: {},
      selectedAlbums: {},
      selectedArtists: {},
      selectedPlaylists: {}
    };
    this.saveProfile();
  }

  public isDisliked(trackId: string): boolean {
    return this.profile.dislikes.includes(trackId);
  }

  public isLiked(trackId: string): boolean {
    return this.profile.likes.includes(trackId);
  }

  /**
   * Session Diversity & Anti-Repetition Rules:
   * 1. Never recommend duplicate songs
   * 2. Penalty for songs recently played in session history
   * 3. Max 2 tracks from the same artist in any 10-track window (unless isArtistRadio)
   * 4. 70% high-similarity / 30% discovery balance
   */
  public applySessionDiversity(
    candidates: Track[],
    history: Track[] = [],
    isArtistRadio = false,
    cooldownWindow = 40
  ): Track[] {
    const deduped = deduplicateTracks(candidates).filter((t) => !this.isDisliked(t.id));
    
    // Consider both playback history and existing upcoming queue (passed as history) for deduplication
    const recentHistory = history.slice(0, cooldownWindow);
    const recentHistoryKeys = new Set(recentHistory.map((t) => getSongDeduplicationKey(t)));

    // Preserve original sorting (which has similarity baked in), but heavily penalize recent history
    const scored = deduped.map((t, index) => {
      // Base score is just the reverse index so original sort order is maintained
      let score = (deduped.length - index) * 10;
      
      const trackKey = getSongDeduplicationKey(t);
      if (recentHistoryKeys.has(trackKey)) {
        // Calculate graduated penalty based on recency to prioritize least-recently-played if forced
        const historyIndex = recentHistory.findIndex(h => getSongDeduplicationKey(h) === trackKey);
        const recencyFactor = 1 - (historyIndex / cooldownWindow); // 1.0 (most recent) to 0.0 (oldest in window)
        score -= (2000 * recencyFactor + 1000); // Penalty from 1000 to 3000 to prevent loops, but allow if it's the absolute ONLY choice
      }
      return { track: t, score };
    });

    // Separate into fresh candidates and cooldown candidates so fresh songs are always selected first
    const freshScored = scored.filter((s) => !recentHistoryKeys.has(getSongDeduplicationKey(s.track)));
    const cooldownScored = scored.filter((s) => recentHistoryKeys.has(getSongDeduplicationKey(s.track)));

    freshScored.sort((a, b) => b.score - a.score);
    cooldownScored.sort((a, b) => b.score - a.score);

    // Apply sliding window artist separation constraint
    const result: Track[] = [];
    const pool = [...freshScored.map((s) => s.track), ...cooldownScored.map((s) => s.track)];
    const artistWindow: string[] = [];

    while (pool.length > 0) {
      let candidateIndex = 0;

      if (!isArtistRadio) {
        // Find first track that doesn't violate the 1-per-5 artist rule
        const found = pool.findIndex((t) => {
          const prim = extractPrimaryArtist(t.artist).toLowerCase();
          const countInWindow = artistWindow.slice(-5).filter((a) => a === prim).length;
          return countInWindow < 1; // Require 5 tracks between same artist
        });
        if (found !== -1) {
          candidateIndex = found;
        }
      }

      const [chosen] = pool.splice(candidateIndex, 1);
      result.push(chosen);

      const prim = extractPrimaryArtist(chosen.artist).toLowerCase();
      artistWindow.push(prim);
      if (artistWindow.length > 10) {
        artistWindow.shift();
      }
    }

    return result;
  }

  /**
   * Listen Again: Tracks played frequently or recently with exponential time-decay logic
   */
  public getListenAgainTracks(catalog: Track[] = TRACKS, history: Track[] = []): Track[] {
    const now = Date.now();
    const playCounts: Record<string, { track: Track; count: number; lastTime: number }> = {};

    history.forEach((t) => {
      if (!t || this.isDisliked(t.id)) return;
      if (!playCounts[t.id]) {
        playCounts[t.id] = {
          track: t,
          count: 0,
          lastTime: t.playedAt || now
        };
      }
      playCounts[t.id].count += 1;
      if (t.playedAt && t.playedAt > playCounts[t.id].lastTime) {
        playCounts[t.id].lastTime = t.playedAt;
      }
    });

    const list = Object.values(playCounts).map(({ track, count, lastTime }) => {
      const daysAgo = Math.max(0, (now - lastTime) / (1000 * 86400));
      // Exponential decay: count * e^(-0.08 * daysAgo)
      const decayScore = count * Math.exp(-0.08 * daysAgo);
      return { track, decayScore };
    });

    list.sort((a, b) => b.decayScore - a.decayScore);

    if (list.length >= 4) {
      return deduplicateTracks(list.map((l) => l.track)).slice(0, 12);
    }

    // Fallback: top affinity tracks
    return deduplicateTracks(catalog.filter((t) => !this.isDisliked(t.id)))
      .sort((a, b) => this.calculateTrackAffinity(b) - this.calculateTrackAffinity(a))
      .slice(0, 10);
  }

  /**
   * Forgotten Favorites:
   * Tracks with high historical engagement or likes that haven't been played in the last 7+ days
   */
  public getForgottenFavorites(catalog: Track[] = TRACKS, history: Track[] = []): FavoriteItem[] {
    const recentHistoryIds = new Set(history.slice(0, 15).map((t) => t.id));
    const allowed = catalog.filter((t) => !this.isDisliked(t.id) && !recentHistoryIds.has(t.id));

    // Scored by likes, loop count, or high plays
    const scored = allowed.map((t) => {
      let score = 0;
      if (this.profile.likes.includes(t.id) || t.isFavorite) score += 40;
      score += (this.profile.loops[t.id] || 0) * 15;
      score += (this.profile.listens[t.id] || 0) * 5;
      return { track: t, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const candidates = scored.slice(0, 8).map((s) => s.track);

    if (candidates.length >= 4) {
      return candidates.map((t, idx) => ({
        id: `fav-forgotten-${t.id}-${idx}`,
        title: t.title,
        artist: t.artist,
        coverUrl: t.coverUrl
      }));
    }

    return FORGOTTEN_FAVORITES;
  }

  /**
   * Dynamic Collage Generator
   */
  private generateCollageGrid(tracks: Track[], fallbackCovers: string[]): string[] {
    const covers: string[] = [];
    for (const t of tracks) {
      if (t.coverUrl && !covers.includes(t.coverUrl)) {
        covers.push(t.coverUrl);
        if (covers.length === 4) break;
      }
    }
    while (covers.length < 4) {
      const fb = fallbackCovers[covers.length] || fallbackCovers[0] || '/streamzy_logo.jpg';
      covers.push(fb);
    }
    return covers;
  }

  /**
   * Generate "My Supermix"
   */
  public generateSupermix(catalog: Track[] = TRACKS): MusicMix {
    const allowed = catalog.filter((t) => !this.isDisliked(t.id));
    const scored = allowed.map((t) => ({
      track: t,
      score: this.calculateTrackAffinity(t) + Math.random() * 8
    }));

    scored.sort((a, b) => b.score - a.score);
    const superTracks = deduplicateTracks(scored.slice(0, 18).map((s) => s.track));
    const topArtists = Array.from(new Set(superTracks.map((t) => extractPrimaryArtist(t.artist)))).slice(0, 3);
    const subtitle = topArtists.length > 0 ? `${topArtists.join(', ')} & more` : 'Your personal musical universe';

    return {
      id: 'mix-supermix',
      title: 'My Supermix',
      subtitle,
      description: 'An endless blend of your favorite artists, evergreen repeats, and personalized discoveries.',
      badge: 'BLENDED FOR YOU',
      gradient: 'from-[#ff007f]/80 via-[#7928ca]/60 to-[#121212]',
      coverGrid: this.generateCollageGrid(superTracks, [
        'https://i.ytimg.com/vi/BddP6PYo2gs/mqdefault.jpg',
        'https://i.ytimg.com/vi/VNs_cCtdbPc/mqdefault.jpg',
        'https://i.ytimg.com/vi/4NRXx6U8ABQ/mqdefault.jpg',
        'https://i.ytimg.com/vi/Hc-rc1-hcco/mqdefault.jpg'
      ]),
      trackIds: superTracks.map((t) => t.id)
    };
  }

  /**
   * Generate "Discover Mix" (Exploration)
   */
  public generateDiscoverMix(catalog: Track[] = TRACKS): MusicMix {
    const allowed = catalog.filter((t) => !this.isDisliked(t.id));
    const unplayed = allowed.filter((t) => !this.profile.listens[t.id]);
    const pool = unplayed.length >= 8 ? unplayed : allowed;

    const scored = pool.map((t) => ({
      track: t,
      score: this.calculateTrackAffinity(t) + Math.random() * 15
    }));

    scored.sort((a, b) => b.score - a.score);
    const discoverTracks = deduplicateTracks(scored.slice(0, 14).map((s) => s.track));
    const artists = Array.from(new Set(discoverTracks.map((t) => extractPrimaryArtist(t.artist)))).slice(0, 3);
    const subtitle = artists.length > 0 ? `${artists.join(', ')} & more` : 'Fresh discoveries aligned with your taste';

    return {
      id: 'mix-discover',
      title: 'Discover Mix',
      subtitle,
      description: 'New and unfamiliar songs from artists in your favorite genres, curated fresh for exploration.',
      badge: 'DISCOVER',
      gradient: 'from-[#00b4db]/80 via-[#0083b0]/60 to-[#121212]',
      coverGrid: this.generateCollageGrid(discoverTracks, [
        'https://i.ytimg.com/vi/vIQAt0eIu2k/mqdefault.jpg',
        'https://i.ytimg.com/vi/J_CD7rFH-O0/mqdefault.jpg',
        'https://i.ytimg.com/vi/ElZfdU54Cp8/mqdefault.jpg',
        'https://i.ytimg.com/vi/IJq0yyWug1k/mqdefault.jpg'
      ]),
      trackIds: discoverTracks.map((t) => t.id)
    };
  }

  /**
   * Generate "New Release Mix"
   */
  public generateNewReleaseMix(catalog: Track[] = TRACKS): MusicMix {
    const allowed = catalog.filter((t) => !this.isDisliked(t.id));
    const recent = allowed.filter((t) => (t.releaseYear || t.year) === '2024');
    const pool = recent.length >= 6 ? recent : allowed;

    const scored = pool.map((t) => ({
      track: t,
      score: this.calculateTrackAffinity(t) + (t.year === '2024' ? 30 : 0) + Math.random() * 6
    }));

    scored.sort((a, b) => b.score - a.score);
    const newTracks = deduplicateTracks(scored.slice(0, 14).map((s) => s.track));
    const artists = Array.from(new Set(newTracks.map((t) => extractPrimaryArtist(t.artist)))).slice(0, 3);
    const subtitle = artists.length > 0 ? `Fresh drops from ${artists.join(', ')} & more` : 'Fresh drops from your favorite artists';

    return {
      id: 'mix-new-release',
      title: 'New Release Mix',
      subtitle,
      description: 'Catch every newly released single, collaboration, and EP in one dynamic feed.',
      badge: 'NEW',
      gradient: 'from-[#ff416c]/80 via-[#ff4b2b]/60 to-[#121212]',
      coverGrid: this.generateCollageGrid(newTracks, [
        'https://i.ytimg.com/vi/BddP6PYo2gs/mqdefault.jpg',
        'https://i.ytimg.com/vi/VAdGW7QDJiU/mqdefault.jpg',
        'https://i.ytimg.com/vi/VNs_cCtdbPc/mqdefault.jpg',
        'https://i.ytimg.com/vi/l8Z3azp_qK8/mqdefault.jpg'
      ]),
      trackIds: newTracks.map((t) => t.id)
    };
  }

  /**
   * Returns all dynamic curated mixes (YouTube Music style: Supermix, Focus, Chill, Workout, Energy, Commute, Party)
   */
  public getAllCuratedMixes(catalog: Track[] = TRACKS): MusicMix[] {
    const supermix = this.generateSupermix(catalog);
    const discoverMix = this.generateDiscoverMix(catalog);
    const newReleaseMix = this.generateNewReleaseMix(catalog);

    const chillTracks = catalog.filter((t) => !this.isDisliked(t.id) && detectVibeAndGenre(t).category === 'chillout').slice(0, 10);
    const energyTracks = catalog
      .filter((t) => !this.isDisliked(t.id) && (detectVibeAndGenre(t).category === 'electronic' || detectVibeAndGenre(t).category === 'punjabi'))
      .slice(0, 10);
    const focusTracks = catalog.filter((t) => !this.isDisliked(t.id) && (detectVibeAndGenre(t).category === 'chillout' || detectVibeAndGenre(t).category === 'indie')).slice(0, 10);
    const partyTracks = catalog
      .filter((t) => !this.isDisliked(t.id) && (detectVibeAndGenre(t).category === 'punjabi' || detectVibeAndGenre(t).category === 'electronic' || detectVibeAndGenre(t).category === 'hiphop'))
      .slice(0, 10);

    const chillMix: MusicMix = {
      id: 'mix-chill',
      title: 'Chill Mix',
      subtitle: 'Darshan Raval, Asees Kaur, Pritam & more',
      description: 'Mellow melodies, acoustic chords, and relaxed evening warmth.',
      badge: 'CHILL',
      gradient: 'from-[#1e3c72]/80 via-[#2a5298]/60 to-[#121212]',
      coverGrid: this.generateCollageGrid(chillTracks, [
        'https://i.ytimg.com/vi/vIQAt0eIu2k/mqdefault.jpg',
        'https://i.ytimg.com/vi/l8Z3azp_qK8/mqdefault.jpg',
        'https://i.ytimg.com/vi/J_CD7rFH-O0/mqdefault.jpg',
        'https://i.ytimg.com/vi/sK7riqg2mr4/mqdefault.jpg'
      ]),
      trackIds: chillTracks.map((t) => t.id)
    };

    const energyMix: MusicMix = {
      id: 'mix-energy',
      title: 'Energy Mix',
      subtitle: 'Sidhu Moosewala, The Weeknd, Alan Walker',
      description: 'High-octane Punjabi drill, driving electronic kicks and upbeat tracks to fuel your grind.',
      badge: 'ENERGY',
      gradient: 'from-[#f12711]/80 via-[#f5af19]/60 to-[#121212]',
      coverGrid: this.generateCollageGrid(energyTracks, [
        'https://i.ytimg.com/vi/n_FCrCQ6-9U/mqdefault.jpg',
        'https://i.ytimg.com/vi/60ItHLz5WEA/mqdefault.jpg',
        'https://i.ytimg.com/vi/4NRXx6U8ABQ/mqdefault.jpg',
        'https://i.ytimg.com/vi/34Na4j8AVgA/mqdefault.jpg'
      ]),
      trackIds: energyTracks.map((t) => t.id)
    };

    const focusMix: MusicMix = {
      id: 'mix-focus',
      title: 'Focus Mix',
      subtitle: 'Shikhar Saxena, Tor, Emancipator',
      description: 'Instrumental flow, minimal vocals, and ambient tones to keep you in the zone.',
      badge: 'FOCUS',
      gradient: 'from-[#11998e]/80 via-[#38ef7d]/60 to-[#121212]',
      coverGrid: this.generateCollageGrid(focusTracks, [
        'https://i.ytimg.com/vi/Hc-rc1-hcco/mqdefault.jpg',
        'https://i.ytimg.com/vi/lYyLVjlsSew/mqdefault.jpg',
        'https://i.ytimg.com/vi/vIQAt0eIu2k/mqdefault.jpg',
        'https://i.ytimg.com/vi/J_CD7rFH-O0/mqdefault.jpg'
      ]),
      trackIds: focusTracks.map((t) => t.id)
    };

    const partyMix: MusicMix = {
      id: 'mix-party',
      title: 'Party Mix',
      subtitle: 'AP Dhillon, Badshah, Diljit Dosanjh',
      description: 'Banging basslines, viral dance floor anthems, and Punjabi party staples.',
      badge: 'PARTY',
      gradient: 'from-[#8e2de2]/80 via-[#4a00e0]/60 to-[#121212]',
      coverGrid: this.generateCollageGrid(partyTracks, [
        'https://i.ytimg.com/vi/VNs_cCtdbPc/mqdefault.jpg',
        'https://i.ytimg.com/vi/n_FCrCQ6-9U/mqdefault.jpg',
        'https://i.ytimg.com/vi/34Na4j8AVgA/mqdefault.jpg',
        'https://i.ytimg.com/vi/60ItHLz5WEA/mqdefault.jpg'
      ]),
      trackIds: partyTracks.map((t) => t.id)
    };

    return [supermix, discoverMix, newReleaseMix, chillMix, energyMix, focusMix, partyMix];
  }

  /**
   * Helper to parse streaming popularity count string into numeric rank weight
   */
  private parsePopularityScore(plays?: string, popularity = 50): number {
    if (plays) {
      const lower = plays.toLowerCase();
      if (lower.includes('b')) {
        const val = parseFloat(lower.replace(/[^0-9.]/g, '')) || 1;
        return Math.min(100, val * 25 + 50);
      }
      if (lower.includes('m')) {
        const val = parseFloat(lower.replace(/[^0-9.]/g, '')) || 1;
        return Math.min(95, val * 0.12 + 45);
      }
      if (lower.includes('lakh')) {
        const val = parseFloat(lower.replace(/[^0-9.]/g, '')) || 1;
        return Math.min(80, val * 0.7 + 35);
      }
    }
    return popularity;
  }

  /**
   * Dynamically generates Quick Picks according to the 8 Core Dimensions:
   * 1. Recent listening (7-day exponential decay & play recency)
   * 2. Favorite artists (explicit favorite artists & top listened artists)
   * 3. Favorite songs (liked tracks & repeat loop counts)
   * 4. Frequently played genres (top user genres & categories)
   * 5. Language (inferred from user history / favorites vs song language)
   * 6. Listening time (time of day context & daypart habits)
   * 7. Current session (current playing track continuity & diversity)
   * 8. Similar songs (acoustic vector cosine & acoustic vibe similarity)
   *
   * If the user has no listening history yet (Cold Start):
   * Uses popularity + genre diversity + language balance + catalog data.
   * As the user listens more, recommendations automatically adapt in real-time.
   */
  public generateQuickPicks(
    catalog: Track[] = TRACKS,
    activeTrack: Track | null = null,
    history: Track[] = [],
    favoriteIds: Set<string> = new Set(),
    forcedTimeOfDay?: TimeOfDay | null,
    limit = 16
  ): {
    quickPicks: Track[];
    isColdStart: boolean;
    metrics: {
      totalEventsAnalyzed: number;
      sevenDayPlaysCount: number;
      highestLoopCount: number;
      contextVibe: string;
      matchedFactors: string[];
    };
  } {
    const allowedCatalog = deduplicateTracks(catalog).filter((t) => !this.isDisliked(t.id));
    const now = Date.now();
    const active = activeTrack || this.profile.lastPlayedTrack || (history.length > 0 ? history[0] : allowedCatalog[0]);
    const { category, vibe } = detectVibeAndGenre(active);

    // 1. Detect if user has any listening history or taste signals
    const historyCount = history.length;
    const profileListensCount = Object.keys(this.profile.listens).length;
    const likesCount = this.profile.likes.length + favoriteIds.size;
    const seedArtistsCount = this.profile.favoriteArtists.length;
    const seedGenresCount = this.profile.favoriteGenres.length;

    const isColdStart =
      historyCount === 0 &&
      profileListensCount === 0 &&
      likesCount === 0 &&
      seedArtistsCount === 0 &&
      seedGenresCount === 0;

    // Time of day calculation
    const hour = new Date().getHours();
    const timeOfDay: TimeOfDay =
      forcedTimeOfDay ||
      (hour >= 5 && hour < 12
        ? 'morning'
        : hour >= 12 && hour < 17
        ? 'afternoon'
        : hour >= 17 && hour < 21
        ? 'evening'
        : 'night');

    const matchedFactors: string[] = [];
    let sevenDayPlaysCount = 0;
    let highestLoopCount = 0;

    // -------------------------------------------------------------
    // COLD-START PATH (Zero listening history yet)
    // Popularity + Genre Diversity + Language Distribution + Catalog Data
    // -------------------------------------------------------------
    if (isColdStart) {
      matchedFactors.push('Catalog Popularity', 'Multi-Language Distribution', 'Genre Diversity', `${timeOfDay} Acoustics`);

      const scoredColdStart = allowedCatalog.map((t) => {
        let score = 0;
        // A. Popularity (0 - 55 pts)
        const popScore = this.parsePopularityScore(t.plays, t.popularity || 50);
        score += popScore * 0.55;

        // B. Time of Day Acoustic Alignment (0 - 25 pts)
        const { category: trackCat } = detectVibeAndGenre(t);
        if (timeOfDay === 'morning' && (trackCat === 'romance' || trackCat === 'soulful' || trackCat === 'chillout')) {
          score += 24;
        } else if (timeOfDay === 'afternoon' && (trackCat === 'punjabi' || trackCat === 'electronic' || trackCat === 'hiphop')) {
          score += 26;
        } else if (timeOfDay === 'evening' && (trackCat === 'bollywood' || trackCat === 'romance' || trackCat === 'pop')) {
          score += 25;
        } else if (timeOfDay === 'night' && (trackCat === 'chillout' || trackCat === 'lofi' || trackCat === 'electronic')) {
          score += 28;
        }

        // C. Language Balance (Ensure Hindi, Punjabi, English representation)
        const lang = (t.language || detectLanguage(t.title, t.artist, t.genre)).toLowerCase();
        if (lang === 'punjabi' || lang === 'hindi' || lang === 'english') {
          score += 15;
        }

        // D. Slight jitter for fresh visual feed on reload
        score += Math.random() * 6;

        return { track: t, score };
      });

      scoredColdStart.sort((a, b) => b.score - a.score);
      const diverseColdStart = this.applySessionDiversity(
        scoredColdStart.map((s) => s.track),
        [],
        false,
        20
      );

      return {
        quickPicks: diverseColdStart.slice(0, limit),
        isColdStart: true,
        metrics: {
          totalEventsAnalyzed: 0,
          sevenDayPlaysCount: 0,
          highestLoopCount: 0,
          contextVibe: `Popular Top Charts • ${timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1)} Mix`,
          matchedFactors
        }
      };
    }

    // -------------------------------------------------------------
    // DYNAMIC ADAPTIVE PATH (User has listening history / favorites)
    // Evaluates all 8 core dimensions
    // -------------------------------------------------------------

    // Factor 1: Recent Listening Analysis (Last 7 days timestamps & decay)
    const recentPlaysMap = new Map<string, { count: number; lastPlayedMs: number }>();
    history.forEach((h, idx) => {
      const hTime = h.playedAt || (now - idx * 3600 * 1000);
      const existing = recentPlaysMap.get(h.id);
      if (!existing) {
        recentPlaysMap.set(h.id, { count: 1, lastPlayedMs: hTime });
      } else {
        existing.count += 1;
        if (hTime > existing.lastPlayedMs) existing.lastPlayedMs = hTime;
      }
    });

    // Factor 4 & 5: Infer User's Preferred Languages & Frequently Played Genres
    const userLanguageCounts: Record<string, number> = {};
    const userGenreCounts: Record<string, number> = {};
    const userArtistCounts: Record<string, number> = {};

    history.forEach((t) => {
      const lang = (t.language || detectLanguage(t.title, t.artist, t.genre)).toLowerCase();
      userLanguageCounts[lang] = (userLanguageCounts[lang] || 0) + 1;
      const { category: c } = detectVibeAndGenre(t);
      userGenreCounts[c] = (userGenreCounts[c] || 0) + 1;
      if (t.artist) {
        extractPrimaryArtist(t.artist).split(/[,&]/).forEach((p) => {
          const clean = p.trim().toLowerCase();
          if (clean) userArtistCounts[clean] = (userArtistCounts[clean] || 0) + 1;
        });
      }
    });

    allowedCatalog.filter((t) => favoriteIds.has(t.id) || this.profile.likes.includes(t.id)).forEach((t) => {
      const lang = (t.language || detectLanguage(t.title, t.artist, t.genre)).toLowerCase();
      userLanguageCounts[lang] = (userLanguageCounts[lang] || 0) + 2;
      const { category: c } = detectVibeAndGenre(t);
      userGenreCounts[c] = (userGenreCounts[c] || 0) + 2;
    });

    // Score candidates against the 8 dimensions
    const scoredCandidates = allowedCatalog.map((track) => {
      let score = 0;
      const trackId = track.id;
      const { category: trackCat } = detectVibeAndGenre(track);
      const trackLang = (track.language || detectLanguage(track.title, track.artist, track.genre)).toLowerCase();
      const primaryArtist = extractPrimaryArtist(track.artist).toLowerCase();

      // =========================================================
      // 1. RECENT LISTENING (Up to +50 pts)
      // =========================================================
      const recentData = recentPlaysMap.get(trackId);
      if (recentData) {
        const daysAgo = Math.max(0, (now - recentData.lastPlayedMs) / (24 * 3600 * 1000));
        if (daysAgo <= 7) {
          sevenDayPlaysCount += recentData.count;
          const decay = Math.exp(-0.12 * daysAgo);
          score += 35 * decay + Math.min(recentData.count * 6, 20);
        }
      }

      // =========================================================
      // 2. FAVORITE ARTISTS (Up to +45 pts)
      // =========================================================
      const isExplicitFavArtist = this.profile.favoriteArtists.some((fav) =>
        primaryArtist.includes(fav.toLowerCase()) || fav.toLowerCase().includes(primaryArtist)
      );
      if (isExplicitFavArtist) score += 35;
      if (userArtistCounts[primaryArtist]) {
        score += Math.min(userArtistCounts[primaryArtist] * 4, 30);
      }
      if (this.profile.topArtists[track.artist]) {
        score += Math.min(this.profile.topArtists[track.artist] * 2, 25);
      }

      // =========================================================
      // 3. FAVORITE SONGS & HIGH LOOPS (Up to +60 pts)
      // =========================================================
      const isFavSong = favoriteIds.has(trackId) || this.profile.likes.includes(trackId) || Boolean(track.isFavorite);
      if (isFavSong) score += 40;

      const loopCount = this.profile.loops[trackId] || 0;
      if (loopCount > 0) {
        highestLoopCount = Math.max(highestLoopCount, loopCount);
        score += loopCount * 22; // Strongest engagement signal
      }

      const listenCount = this.profile.listens[trackId] || 0;
      if (listenCount > 0) {
        score += Math.min(listenCount * 5, 30);
      }

      const skipCount = this.profile.skips[trackId] || 0;
      if (skipCount > 0) {
        score -= skipCount * 15;
      }

      // =========================================================
      // 4. FREQUENTLY PLAYED GENRES (Up to +30 pts)
      // =========================================================
      if (this.profile.favoriteGenres.some((g) => g.toLowerCase().includes(trackCat) || trackCat.includes(g.toLowerCase()))) {
        score += 25;
      }
      if (userGenreCounts[trackCat]) {
        score += Math.min(userGenreCounts[trackCat] * 3, 24);
      }

      // =========================================================
      // 5. LANGUAGE AFFINITY (Up to +22 pts)
      // =========================================================
      if (userLanguageCounts[trackLang]) {
        score += Math.min(userLanguageCounts[trackLang] * 3, 22);
      }

      // =========================================================
      // 6. LISTENING TIME & DAYPART CONTEXT (Up to +28 pts)
      // =========================================================
      if (timeOfDay === 'morning') {
        if (trackCat === 'romance' || trackCat === 'soulful' || trackCat === 'chillout') score += 24;
        else if (trackCat === 'pop') score += 16;
      } else if (timeOfDay === 'afternoon') {
        if (trackCat === 'punjabi' || trackCat === 'electronic' || trackCat === 'hiphop') score += 28;
        else if (trackCat === 'pop') score += 18;
      } else if (timeOfDay === 'evening') {
        if (trackCat === 'bollywood' || trackCat === 'romance' || trackCat === 'soulful') score += 26;
        else if (trackCat === 'punjabi') score += 15;
      } else {
        if (trackCat === 'chillout' || trackCat === 'lofi' || trackCat === 'electronic') score += 30;
        else if (trackCat === 'soulful') score += 18;
      }

      // =========================================================
      // 7. CURRENT SESSION CONTINUITY (Up to +35 pts)
      // =========================================================
      if (active) {
        if (areTracksEqual(track, active)) {
          // Explicitly exclude currently playing song from Quick Picks recommendations
          score -= 2000;
        } else if (primaryArtist === extractPrimaryArtist(active.artist).toLowerCase()) {
          score += 25;
        }
        if (trackCat === category) {
          score += 20;
        }
      }

      // =========================================================
      // 8. SIMILAR SONGS ACOUSTIC SIMILARITY (Up to +35 pts)
      // =========================================================
      if (active) {
        const acousticSim = calculateTrackSimilarity(active, track);
        score += acousticSim * 35;
      }

      // Popularity base baseline
      const popBase = this.parsePopularityScore(track.plays, track.popularity || 50);
      score += popBase * 0.15;

      // Jitter to ensure fresh, dynamic non-static recommendations on repeated visits
      score += Math.random() * 16;

      return { track, score };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);

    // Apply anti-fatigue sliding window diversity
    const dynamicQuickPicks = this.applySessionDiversity(
      scoredCandidates.map((s) => s.track),
      history,
      false,
      30
    );

    matchedFactors.push(
      'Recent 7d Plays',
      'Favorite Artists',
      'Liked Songs & Loops',
      'Top Genres',
      'Language Preferences',
      `${timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1)} Habits`,
      'Session Continuity',
      'Acoustic Similarity'
    );

    return {
      quickPicks: dynamicQuickPicks.slice(0, limit),
      isColdStart: false,
      metrics: {
        totalEventsAnalyzed: historyCount + profileListensCount,
        sevenDayPlaysCount,
        highestLoopCount,
        contextVibe: `${vibe} • ${timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1)} Adaptive`,
        matchedFactors
      }
    };
  }

  /**
   * Instantly synchronously generates a highly personalized Up-Next queue
   * with seed similarity ranking, session anti-repetition, context preservation, and diversity rules.
   */
  public getInstantPersonalizedQueue(
    seedTrack: Track,
    catalog: Track[] = TRACKS,
    history: Track[] = [],
    context?: PlaybackContext
  ): Track[] {
    const dedupedCatalog = deduplicateTracks(catalog);
    const candidates = dedupedCatalog.filter(
      (t) => !areTracksEqual(t, seedTrack) && !this.isDisliked(t.id)
    );

    const historyIds = new Set(history.map((t) => t.id));
    const likedIds = new Set(this.profile.likes);
    const favoriteArtistsSet = new Set((this.profile.favoriteArtists || []).map((a) => a.toLowerCase()));
    const favoriteGenresSet = new Set((this.profile.favoriteGenres || []).map((g) => g.toLowerCase()));
    
    const seedVibe = detectVibeAndGenre(seedTrack);
    const seedArtist = extractPrimaryArtist(seedTrack.artist).toLowerCase();
    const seedAlbum = (seedTrack.album || '').trim().toLowerCase();
    const seedYear = parseInt(seedTrack.releaseYear || seedTrack.year || '2024', 10);

    const isArtistContext = context?.type === 'artist' || Boolean(context?.artist);
    const contextArtist = (context?.artist || (context?.type === 'artist' ? context.title : '') || '').toLowerCase();
    const contextGenre = (context?.genre || '').toLowerCase();

    // Find any unplayed remaining tracks from source album / playlist context
    const contextSourceTrackIds = new Set(
      (context?.sourceTracks || [])
        .filter((t) => !areTracksEqual(t, seedTrack) && !history.some((h) => areTracksEqual(h, t)))
        .map((t) => t.id)
    );

    // Score every candidate by blending multiple context dimensions (Weighted Ranking)
    const scored = candidates.map((t) => {
      const similarity = calculateTrackSimilarity(seedTrack, t);
      const affinity = this.calculateTrackAffinity(t);
      const vibe = detectVibeAndGenre(t);
      const tArtist = extractPrimaryArtist(t.artist).toLowerCase();
      const tAlbum = (t.album || '').trim().toLowerCase();
      const tYear = parseInt(t.releaseYear || t.year || '2024', 10);
      
      // Base Content Similarity (Same Artist, Similar Artists, Genre, Mood): 0 - 100
      let score = similarity * 100;
      
      // Tier 1: Primary Singer / Artist Priority Match (+1000)
      if (tArtist === seedArtist || t.artist.toLowerCase() === seedTrack.artist.toLowerCase()) {
        score += 1000;
      } else if (
        t.artist.toLowerCase().includes(seedArtist) ||
        seedTrack.artist.toLowerCase().includes(tArtist) ||
        (seedTrack.relatedArtists || []).some((r) => r.toLowerCase() === tArtist)
      ) {
        score += 600; // Collaborator / featuring artist boost
      }

      // Tier 2: Genre / Vibe Priority Match (+350)
      if (vibe.category === seedVibe.category) {
        score += 350;
      } else if (seedTrack.genre && t.genre && (seedTrack.genre.toLowerCase().includes(t.genre.toLowerCase()) || t.genre.toLowerCase().includes(seedTrack.genre.toLowerCase()))) {
        score += 250;
      }

      // Tier 3: Song Language Priority Match (+200)
      const targetLang = (this.lockedLanguage || seedTrack.language || detectLanguage(seedTrack.title, seedTrack.artist, seedTrack.genre)).toLowerCase();
      const tLang = (t.language || detectLanguage(t.title, t.artist, t.genre)).toLowerCase();
      if (tLang === targetLang) {
        score += 200;
      }

      // 0. Explicit Context Track Match (Remaining tracks from active album/playlist)
      if (contextSourceTrackIds.has(t.id)) {
        score += 150;
      }

      // 0b. Playback Context Artist / Genre alignment
      if (contextArtist && (tArtist === contextArtist || t.artist.toLowerCase().includes(contextArtist))) {
        score += 80;
      }
      if (contextGenre && (t.genre || '').toLowerCase().includes(contextGenre)) {
        score += 45;
      }

      // 1. Same Album & Era Context Match
      if (seedAlbum && tAlbum && seedAlbum === tAlbum) {
        score += 25;
      }
      if (Math.abs(seedYear - tYear) <= 2) {
        score += 10;
      }

      // 2. User-Preferred Songs & Artist Affinities
      if (likedIds.has(t.id)) {
        score += 30; // Direct user favorite boost
      }
      if (favoriteArtistsSet.has(tArtist) || (this.profile.topArtists && this.profile.topArtists[tArtist])) {
        score += 20; // Preferred artist boost
      }
      if (favoriteGenresSet.has((t.genre || '').toLowerCase())) {
        score += 15; // Preferred genre boost
      }
      score += affinity * 0.4; // General affinity vector

      // 4. Popularity & Trending Weighting (Popular related songs)
      score += (t.popularity || 50) * 0.3;

      // 5. Familiarity from long-term history (outside cooldown)
      if (historyIds.has(t.id)) {
        score += 10;
      }

      return { track: t, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Apply strict session diversity & sliding window artist separation (relaxed if artist radio/context)
    const diverseList = this.applySessionDiversity(scored.map((s) => s.track), history, isArtistContext);
    return this.prioritizeQueue(diverseList, seedTrack);
  }

  /**
   * Generates a fully personalized YouTube Music style Up-Next queue.
   * Blends instant catalog recommendations with live online radio tracks from Invidious/Piped,
   * while preserving playback context and strictly eliminating duplicates.
   */
  public async generatePersonalizedQueue(
    seedTrack: Track,
    catalog: Track[] = TRACKS,
    history: Track[] = [],
    context?: PlaybackContext
  ): Promise<Track[]> {
    let finalQueue: Track[] = [];
    const isArtistContext = context?.type === 'artist' || Boolean(context?.artist);

    try {
      const instantQueue = this.getInstantPersonalizedQueue(seedTrack, catalog, history, context);

      if (seedTrack.videoId) {
        try {
          const liveRelated = await getRelatedTracksFromVideo(seedTrack.videoId, seedTrack.artist);
          if (liveRelated && liveRelated.length > 0) {
            const normalizedRelated = deduplicateTracks(liveRelated.map(normalizeTrack))
              .filter((t) => !areTracksEqual(t, seedTrack) && !this.isDisliked(t.id));
            
            // Interleave: 70% related, 30% catalog instant recommendations
            const combined = deduplicateTracks([...normalizedRelated, ...instantQueue]);
            finalQueue = this.applySessionDiversity(combined, history, isArtistContext);
          }
        } catch {
          // Silent fallback to instant queue
        }
      }

      if (finalQueue.length === 0 && instantQueue.length > 0) {
        finalQueue = instantQueue;
      }
    } catch (err) {
      console.warn('[Personalization] Recommendations generation failed, using fallback strategy', err);
    }

    // Safety Net: Never return an empty queue if valid catalog items exist.
    // Fall back to relevant popular songs.
    if (!finalQueue || finalQueue.length === 0) {
      console.log('[Personalization] Queue empty, falling back to popular catalog songs');
      const popularFallback = deduplicateTracks([...catalog])
        .filter((t) => !areTracksEqual(t, seedTrack) && !this.isDisliked(t.id))
        .sort((a, b) => {
          const popA = a.popularity || 50;
          const popB = b.popularity || 50;
          return popB - popA;
        })
        .slice(0, 20);
        
      return this.prioritizeQueue(popularFallback, seedTrack);
    }

    return this.prioritizeQueue(finalQueue, seedTrack);
  }

  /**
   * Rebuilds the entire Home Screen recommendation layout dynamically.
   * Enforces STRICT cross-section deduplication (no track is repeated across sections)
   * and threshold filtering (sections are only displayed when sufficient relevant data exists).
   */
  public generatePersonalizedHome(
    seedTrack: Track | null,
    catalog: Track[] = TRACKS,
    history: Track[] = [],
    favoriteIds: Set<string> = new Set()
  ): PersonalizedHomeData {
    const active = seedTrack || this.profile.lastPlayedTrack || (history.length > 0 ? history[0] : catalog[Math.floor(Math.random() * Math.min(catalog.length, 15))]);
    const { vibe, category } = detectVibeAndGenre(active);

    const allowedCatalog = deduplicateTracks(catalog).filter((t) => !this.isDisliked(t.id));
    const usedTrackKeys = new Set<string>();
    if (seedTrack) {
      usedTrackKeys.add(getSongDeduplicationKey(seedTrack));
      if (seedTrack.id) usedTrackKeys.add(seedTrack.id);
    }

    const sections: DynamicHomeSection[] = [];

    // Helper: deduplicate & select tracks ensuring they haven't been used in previous sections
    // AND enforcing diversity across artists and genres (max 2 songs per artist per section)
    const pickUniqueTracks = (
      candidates: Track[],
      count: number,
      minRequired = 3,
      maxPerArtist = 2
    ): Track[] => {
      const selected: Track[] = [];
      const artistCounts = new Map<string, number>();

      for (const track of candidates) {
        if (selected.length >= count) break;
        const trackKey = getSongDeduplicationKey(track);
        const trackId = track.id;
        if (usedTrackKeys.has(trackKey) || (trackId && usedTrackKeys.has(trackId))) {
          continue;
        }

        const primaryArtist = extractPrimaryArtist(track.artist || '').toLowerCase();
        const curCount = artistCounts.get(primaryArtist) || 0;
        if (curCount >= maxPerArtist && candidates.length > count * 1.5) {
          continue; // Ensure artist diversity
        }

        selected.push(track);
        usedTrackKeys.add(trackKey);
        if (trackId) usedTrackKeys.add(trackId);
        artistCounts.set(primaryArtist, curCount + 1);
      }

      // If strict artist capping resulted in too few tracks, backfill with remaining available tracks
      if (selected.length < minRequired) {
        for (const track of candidates) {
          if (selected.length >= count) break;
          const trackKey = getSongDeduplicationKey(track);
          const trackId = track.id;
          if (usedTrackKeys.has(trackKey) || (trackId && usedTrackKeys.has(trackId))) {
            continue;
          }
          selected.push(track);
          usedTrackKeys.add(trackKey);
          if (trackId) usedTrackKeys.add(trackId);
        }
      }

      if (selected.length < minRequired) return [];
      return selected;
    };

    // -------------------------------------------------------------
    // SECTION 1: CONTINUE LISTENING (Only if history has valid items)
    // -------------------------------------------------------------
    let continueListeningTracks: Track[] = [];
    if (history.length >= 1) {
      const historyDeduped = deduplicateTracks(history).filter((t) => !this.isDisliked(t.id));
      continueListeningTracks = pickUniqueTracks(historyDeduped, 6, 1);
      if (continueListeningTracks.length > 0) {
        sections.push({
          id: 'section-continue-listening',
          type: 'continue_listening',
          title: 'Continue listening',
          subtitle: 'Pick up right where you left off',
          badge: 'RESUME',
          tracks: continueListeningTracks
        });
      }
    }

    // -------------------------------------------------------------
    // SECTION 2: BECAUSE YOU LISTENED TO... (Targeted seed-based affinity)
    // -------------------------------------------------------------
    let becauseYouListenedData: { seed: Track; tracks: Track[] } | undefined = undefined;
    const seedArtist = extractPrimaryArtist(active.artist);
    if (active && allowedCatalog.length > 0) {
      const becauseCandidates = allowedCatalog
        .filter((t) => !usedTrackKeys.has(getSongDeduplicationKey(t)) && !areTracksEqual(t, active))
        .map((t) => {
          const sim = calculateTrackSimilarity(active, t);
          return { track: t, score: sim * 100 + (this.calculateTrackAffinity(t) * 0.3) };
        });

      becauseCandidates.sort((a, b) => b.score - a.score);
      const becauseTracks = pickUniqueTracks(becauseCandidates.map((b) => b.track), 8, 3);

      if (becauseTracks.length >= 3) {
        becauseYouListenedData = { seed: active, tracks: becauseTracks };
        sections.push({
          id: 'section-because-you-listened',
          type: 'because_you_listened',
          title: `Because you listened to ${active.title}`,
          subtitle: `Similar tracks from ${seedArtist} & related sounds`,
          badge: 'SIMILAR SOUNDS',
          tracks: becauseTracks
        });
      }
    }

    // -------------------------------------------------------------
    // SECTION 4: RECOMMENDED FOR YOU (Broad multi-factor vector blend)
    // -------------------------------------------------------------
    const scoredRecommended = allowedCatalog
      .filter((t) => !usedTrackKeys.has(getSongDeduplicationKey(t)))
      .map((t) => {
        const affinity = this.calculateTrackAffinity(t);
        const pop = (t.popularity || 50) * 0.2;
        const vibeMatch = detectVibeAndGenre(t).category === category ? 15 : 0;
        return { track: t, score: affinity + pop + vibeMatch + Math.random() * 5 };
      });

    scoredRecommended.sort((a, b) => b.score - a.score);
    const recommendedForYou = pickUniqueTracks(scoredRecommended.map((r) => r.track), 8, 3);
    if (recommendedForYou.length >= 3) {
      sections.push({
        id: 'section-recommended-for-you',
        type: 'recommended_for_you',
        title: 'Recommended for you',
        subtitle: 'Personalized based on your musical taste and history',
        badge: 'TAILORED',
        tracks: recommendedForYou
      });
    }

    // -------------------------------------------------------------
    // SECTION 5: YOUR MIX / MADE FOR YOU (Signature 2x2 Collage Stations)
    // -------------------------------------------------------------
    const curatedMixes = this.getAllCuratedMixes(catalog);
    if (curatedMixes.length >= 2) {
      sections.push({
        id: 'section-curated-mixes',
        type: 'mixes',
        title: 'Mixed for you',
        subtitle: 'Endless algorithmic radio mixes crafted for your day',
        badge: 'STATIONS',
        mixes: curatedMixes
      });
    }

    // -------------------------------------------------------------
    // SECTION 6: SIMILAR TO YOUR FAVORITES (Only if user has favorite/liked tracks)
    // -------------------------------------------------------------
    let similarToFavorites: Track[] = [];
    const allFavTrackIds = new Set([...Array.from(favoriteIds), ...this.profile.likes]);
    const favoriteTracks = catalog.filter((t) => allFavTrackIds.has(t.id));

    if (favoriteTracks.length > 0) {
      const favCandidates = allowedCatalog
        .filter((t) => !usedTrackKeys.has(getSongDeduplicationKey(t)) && !allFavTrackIds.has(t.id))
        .map((t) => {
          let maxSim = 0;
          for (const fav of favoriteTracks) {
            const sim = calculateTrackSimilarity(fav, t);
            if (sim > maxSim) maxSim = sim;
          }
          return { track: t, score: maxSim * 100 + this.calculateTrackAffinity(t) * 0.2 };
        });

      favCandidates.sort((a, b) => b.score - a.score);
      similarToFavorites = pickUniqueTracks(favCandidates.map((f) => f.track), 8, 3);

      if (similarToFavorites.length >= 3) {
        sections.push({
          id: 'section-similar-favorites',
          type: 'similar_to_favorites',
          title: 'Similar to your favorites',
          subtitle: 'Fresh discoveries mathematically aligned with songs you love',
          badge: 'FAVORITES',
          tracks: similarToFavorites
        });
      }
    }

    // -------------------------------------------------------------
    // SECTION 7: TRENDING / POPULAR (High streams, charts, and hits)
    // -------------------------------------------------------------
    const trendingCandidates = allowedCatalog
      .filter((t) => !usedTrackKeys.has(getSongDeduplicationKey(t)))
      .map((t) => ({
        track: t,
        score: (t.popularity || 50) + (t.plays ? 20 : 0) + Math.random() * 5
      }));

    trendingCandidates.sort((a, b) => b.score - a.score);
    const trendingTracks = pickUniqueTracks(trendingCandidates.map((t) => t.track), 8, 3);
    if (trendingTracks.length >= 3) {
      sections.push({
        id: 'section-trending',
        type: 'trending',
        title: 'Trending & popular',
        subtitle: 'Global viral hits and high-streaming chart toppers',
        badge: 'CHARTS',
        tracks: trendingTracks
      });
    }

    // -------------------------------------------------------------
    // SECTION 8: NEW RELEASES (Fresh drops & singles from 2024)
    // -------------------------------------------------------------
    const newReleaseCandidates = allowedCatalog
      .filter((t) => !usedTrackKeys.has(getSongDeduplicationKey(t)) && ((t.releaseYear || t.year) === '2024' || (t.releaseYear || t.year) === '2023'));

    const newReleases = pickUniqueTracks(newReleaseCandidates, 8, 3);
    if (newReleases.length >= 3) {
      sections.push({
        id: 'section-new-releases',
        type: 'new_releases',
        title: 'New releases',
        subtitle: 'Fresh singles, EPs, and album drops',
        badge: 'NEW',
        tracks: newReleases
      });
    }

    // -------------------------------------------------------------
    // SECTION 9: ARTIST RECOMMENDATIONS (Dynamic artist avatars)
    // -------------------------------------------------------------
    const artistMap = new Map<string, {
      id: string;
      name: string;
      avatarUrl: string;
      genres: Set<string>;
      topTrack?: Track;
      trackCount: number;
    }>();

    catalog.forEach((t) => {
      const prim = extractPrimaryArtist(t.artist);
      if (!prim) return;
      if (!artistMap.has(prim)) {
        artistMap.set(prim, {
          id: `artist-${prim.toLowerCase().replace(/\s+/g, '-')}`,
          name: prim,
          avatarUrl: t.coverUrl || '/streamzy_logo.jpg',
          genres: new Set<string>(),
          topTrack: t,
          trackCount: 0
        });
      }
      const entry = artistMap.get(prim)!;
      entry.trackCount += 1;
      if (t.genre) entry.genres.add(t.genre);
    });

    const artistList = Array.from(artistMap.values()).map((a) => {
      let score = 0;
      const lowerName = a.name.toLowerCase();
      if (this.profile.favoriteArtists.some((fav) => fav.toLowerCase() === lowerName)) score += 40;
      if (this.profile.topArtists[lowerName]) score += this.profile.topArtists[lowerName] * 10;
      if (lowerName === seedArtist.toLowerCase()) score += 30;
      return {
        id: a.id,
        name: a.name,
        avatarUrl: a.avatarUrl,
        genres: Array.from(a.genres),
        topTrack: a.topTrack,
        subscribers: `${(a.trackCount * 1.4 + 1.2).toFixed(1)}M listeners`,
        monthlyListeners: `${(a.trackCount * 3.8 + 2.5).toFixed(1)}M`,
        score
      };
    });

    artistList.sort((a, b) => b.score - a.score);
    const artistRecommendations = artistList.slice(0, 8);
    if (artistRecommendations.length >= 3) {
      sections.push({
        id: 'section-artist-recommendations',
        type: 'artists',
        title: 'Artist recommendations',
        subtitle: 'Featured creators and vocalists matched to your taste',
        badge: 'ARTISTS',
        artists: artistRecommendations
      });
    }

    // -------------------------------------------------------------
    // SECTION 10: ALBUM RECOMMENDATIONS (Curated & related albums)
    // -------------------------------------------------------------
    const matchingAlbums = RELATED_ALBUMS.filter(
      (a) => a.artist.toLowerCase().includes(seedArtist.toLowerCase())
    );
    const otherAlbums = RELATED_ALBUMS.filter(
      (a) => !a.artist.toLowerCase().includes(seedArtist.toLowerCase())
    );
    const albumRecommendations = [...matchingAlbums, ...otherAlbums];
    if (albumRecommendations.length >= 2) {
      sections.push({
        id: 'section-album-recommendations',
        type: 'albums',
        title: 'Album recommendations',
        subtitle: 'Full project collections, soundtracks, and studio releases',
        badge: 'ALBUMS',
        albums: albumRecommendations
      });
    }

    // -------------------------------------------------------------
    // SECTION 11: RECENTLY PLAYED (History archive, if >= 3 songs)
    // -------------------------------------------------------------
    let recentlyPlayed: Track[] = [];
    if (history.length >= 3) {
      recentlyPlayed = deduplicateTracks(history).slice(0, 10);
      // We can expose this in the data object for dedicated history tabs or fallback
    }

    const listenAgain = this.getListenAgainTracks(catalog, history);
    const forgottenFavorites = this.getForgottenFavorites(catalog, history);

    const quickPicks: Track[] = [];
    const similarTastes: FavoriteItem[] = recommendedForYou.slice(0, 6).map((t, idx) => ({
      id: `fav-pers-${t.id}-${idx}`,
      title: t.title,
      artist: t.artist,
      coverUrl: t.coverUrl
    }));

    return {
      vibeBadge: vibe,
      radioName: `${seedArtist} Radio`,
      radioVibe: vibe,
      sections,
      quickPicks,
      continueListening: continueListeningTracks,
      becauseYouListened: becauseYouListenedData,
      recommendedForYou,
      similarToFavorites,
      curatedMixes,
      recentlyPlayed,
      trendingTracks,
      newReleases,
      artistRecommendations,
      albumRecommendations,
      similarTastes,
      relatedAlbums: albumRecommendations,
      listenAgain,
      forgottenFavorites,
      basedOnSection: becauseYouListenedData ? {
        title: `Because you listened to ${becauseYouListenedData.seed.title}`,
        subtitle: `More tracks from ${seedArtist} • ${vibe}`,
        tracks: becauseYouListenedData.tracks
      } : undefined
    };
  }
}

export const personalizationService = new PersonalizationService();
