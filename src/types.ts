export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album: string;
  albumId?: string;
  albumArt?: string; // Standard normalized field
  coverUrl: string;  // Synced with albumArt for UI compatibility
  duration: string;
  durationSec: number;
  audioUrl?: string;
  streamUrl?: string; // Synced with audioUrl
  source?: 'youtube' | 'local' | 'piped' | 'invidious' | 'server' | 'jiosaavn';
  genre?: string;
  language?: string;
  releaseYear?: string;
  year?: string; // Synced with releaseYear
  explicit?: boolean;
  popularity?: number;
  playCount?: number;
  likes?: number;
  searchableText?: string;
  relatedArtists?: string[];
  relatedSongs?: string[];
  relatedAlbums?: string[];
  isFavorite?: boolean;
  quality?: string;
  lyrics?: { time: number; text: string }[];
  videoId?: string;
  plays?: string;
  isDownloaded?: boolean;
  isSmartDownloaded?: boolean;
  playedAt?: number;
  playDurationSec?: number;
  completionPercentage?: number;
  playbackContext?: PlaybackContext;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface HistoryRecord {
  id: string;
  track: Track;
  playedAt: number;
  playDurationSec: number;
  completionPercentage: number;
  context?: PlaybackContext;
  playCount?: number;
}

export interface DownloadRecord {
  trackId: string;
  track: Track;
  downloadedAt: number;
  sizeBytes: number;
  isSmartDownload: boolean;
  quality: string;
}

export interface Artist {
  id: string;
  name: string;
  avatarUrl: string;
  isSubscribed?: boolean;
  subscribers?: string;
  monthlyListeners?: string;
  trackCount: number;
  albumCount: number;
  genres: string[];
  bio?: string;
  topTracks?: string[];
  relatedArtistIds?: string[];
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  year: string;
  releaseYear?: string;
  coverUrl: string;
  albumArt?: string;
  trackCount?: number;
  genre?: string;
  tracks?: Track[];
}

export interface FavoriteItem {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  tracks: Track[];
}

export interface MusicMix {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge?: string;
  coverGrid: string[];
  gradient: string;
  trackIds: string[];
}

export interface MusicVideoItem {
  id: string;
  title: string;
  artist: string;
  duration: string;
  views: string;
  thumbnailUrl: string;
  videoId: string;
  releaseDate?: string;
  trackId?: string;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface TimeContextInfo {
  timeOfDay: TimeOfDay;
  greeting: string;
  subtitle: string;
  icon: string;
  recommendedVibes: string[];
  ambientColor: string;
}

export type AccentColor = 'cherry' | 'cyan' | 'coral' | 'orange' | 'emerald' | 'purple';
export type ActiveScreen = 'home' | 'explore' | 'search' | 'library' | 'offline' | 'plugins' | 'settings';

export interface BloomeePlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  icon: string;
  type: 'audio_streamer' | 'metadata' | 'lyrics' | 'local';
  isEnabled: boolean;
  priority: number;
  capabilities: string[];
  isOfficial?: boolean;
  sourceUrl?: string;
}

export interface LocalAudioFile {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationSec: number;
  fileSize: string;
  fileSizeBytes: number;
  format: string;
  url: string;
  dateAdded: number;
}

export interface LyricsLine {
  time: number;
  text: string;
}
export type PlayerLayout = 'vimusic' | 'opentune';
export type FilterChip = 'quick_picks' | 'songs' | 'albums' | 'artists' | 'playlists';
export type SearchFilterCategory = 'all' | 'songs' | 'albums' | 'artists' | 'playlists';

export type UserSignalType =
  | 'play_started'
  | 'play_completed'
  | 'skip'
  | 'replay'
  | 'like'
  | 'unlike'
  | 'favorite'
  | 'unfavorite'
  | 'search'
  | 'song_selected'
  | 'album_selected'
  | 'artist_selected'
  | 'playlist_selected'
  | 'listening_duration';

export interface UserSignal {
  id: string;
  type: UserSignalType;
  timestamp: number;
  trackId?: string;
  trackTitle?: string;
  artist?: string;
  genre?: string;
  album?: string;
  playlistId?: string;
  playlistTitle?: string;
  searchQuery?: string;
  listenedSec?: number;
  totalDurationSec?: number;
  completionRatio?: number;
  isImmediateSkip?: boolean;
  weightDelta: number;
  description: string;
}

export interface TrackScoreFactor {
  name: string;
  points: number;
  type: 'positive' | 'negative' | 'neutral';
  description: string;
}

export interface RecommendationWeights {
  similarityWeight: number;            // Default: 25.0
  artistPreferenceWeight: number;      // Default: 20.0
  genrePreferenceWeight: number;       // Default: 15.0
  languagePreferenceWeight: number;    // Default: 10.0
  popularityWeight: number;            // Default: 10.0
  historyWeight: number;               // Default: 15.0
  likeWeight: number;                  // Default: 25.0
  contextWeight: number;               // Default: 12.0
  recentPlayPenaltyWeight: number;     // Default: 20.0
  duplicatePenaltyWeight: number;      // Default: 30.0
  skipPenaltyWeight: number;           // Default: 25.0
}

export interface RecommendationScoreBreakdown {
  trackId: string;
  trackTitle: string;
  artist: string;
  genre?: string;

  // Normalized component values (0.0 to 1.0)
  rawSimilarity?: number;
  rawArtistPreference?: number;
  rawGenrePreference?: number;
  rawLanguagePreference?: number;
  rawPopularity?: number;
  rawHistory?: number;
  rawLike?: number;
  rawContext?: number;
  rawRecentPlayPenalty?: number;
  rawDuplicatePenalty?: number;
  rawSkipPenalty?: number;

  // Weighted score contributions (component * weight)
  similarityScore: number;
  artistPreferenceScore: number;
  genrePreferenceScore: number;
  languagePreferenceScore: number;
  popularityScore: number;
  historyScore: number;
  likeScore: number;
  contextScore: number;
  recentPlayPenalty: number;
  duplicatePenalty: number;
  skipPenalty: number;

  // Total raw score before normalization & clamping
  rawRecommendationScore?: number;
  rawScore?: number;
  totalScore?: number;
  recommendationScore?: number;

  // Normalized score (0 - 100)
  normalizedScore: number;

  // Factors explanation list for UI transparency / inspector
  factors: TrackScoreFactor[];
  weights?: RecommendationWeights;
}

export interface ScoredTrack {
  track: Track;
  score: number; // normalized score 0 - 100
  rawScore?: number;
  recommendationScore?: number;
  normalizedScore?: number;
  breakdown: RecommendationScoreBreakdown;
}

export interface RecommendationContext {
  seedTrack?: Track | null;
  history?: Track[];
  recentHistory?: Track[];
  queue?: Track[];
  currentQueue?: Track[];
  favoriteIds?: Set<string>;
  usedKeys?: Set<string>;
  usedTrackKeys?: Set<string>;
  excludedTrackIds?: string[];
  preferredLanguages?: string[];
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  currentVibe?: string;
  isArtistRadio?: boolean;
  cooldownWindow?: number;
  weights?: Partial<RecommendationWeights>;
  targetLanguage?: string;
  targetGenre?: string;
}

export interface TrackScoreBreakdown {
  trackId: string;
  trackTitle: string;
  artist: string;
  genre?: string;
  totalScore: number;
  factors: TrackScoreFactor[];
  artistAffinity: number;
  genreAffinity: number;
  skipPenalty: number;
  repeatedSkipPenalty: number;
  likeBonus: number;
  replayBonus: number;
  completionBonus: number;
  selectionBonus: number;
  durationBonus: number;
  searchBonus: number;
}

export interface UserTastePreferences {
  favoriteGenres: string[];
  favoriteArtists: string[];
  onboardingCompleted: boolean;
  dislikedTrackIds: string[];
}

export interface LyricMatchDetail {
  matchedLine: string;
  timestampSec: number;
}

export type SearchMatchType =
  | 'exact_title'
  | 'title_starts_with'
  | 'title_contains'
  | 'exact_artist'
  | 'artist_starts_with'
  | 'artist_contains'
  | 'album_match'
  | 'metadata_match'
  | 'lyric_match'
  | 'online_match';

export interface NormalizedSearchResult extends Track {
  thumbnail?: string;
  matchType?: SearchMatchType;
  relevanceScore?: number;
  matchedLyricSnippet?: LyricMatchDetail;
  lyricMatch?: LyricMatchDetail;
  matchScore?: number;
}

export type EnrichedTrackSearchResult = NormalizedSearchResult;

export interface ContextualSearchResults {
  query: string;
  correctedQuery?: string;
  hasTypoCorrection: boolean;
  topResult?: {
    type: 'song' | 'artist' | 'album';
    item: Track | Artist | Album;
  };
  songs: EnrichedTrackSearchResult[];
  albums: Album[];
  artists: Artist[];
  playlists: (Playlist | MusicMix)[];
}

export type BitrateTier = 'dataSaver' | 'standard' | 'high' | 'audiophile';
export type StreamingProtocol = 'hls' | 'dash' | 'chunked';

export interface AbrMetrics {
  currentBitrateKbps: number;
  tier: BitrateTier;
  tierLabel: string;
  networkSpeedKbps: number;
  latencyMs: number;
  bufferHealthSec: number;
  protocol: string;
  isPrebuffered: boolean;
  prebufferedTrackId?: string;
  prebufferedTrackTitle?: string;
}

export interface PlaybackContext {
  type: 'album' | 'playlist' | 'artist' | 'genre' | 'search' | 'history' | 'mix' | 'radio' | 'all';
  id?: string;
  title?: string;
  artist?: string;
  genre?: string;
  language?: string;
  sourceTracks?: Track[];
  sourceIndex?: number;
}

export interface SettingsState {
  dynamicColors: boolean;
  accentColor: AccentColor;
  pureBlackAmoled: boolean;
  playerLayout: PlayerLayout;
  defaultTab: string;
  showQuickPicksFullscreen: boolean;
  aodDisplay: boolean;
  discordRpc: boolean;
  lastFm: boolean;
  listenBrainz: boolean;
  invidiousInstance: string;
  audioQuality: string;
  volumeNormalization: boolean;
  skipSilence: boolean;
  skipSponsor: boolean;
  equalizerPreset: string;
  equalizerBands?: number[];
  crossfadeDurationSec?: number;
  smartReplace?: boolean;
  countryCode?: string;
  lastfmUsername?: string;
  sleepTimerRemaining: number | null; // in minutes
  outputDevice: string;
  enableOfflineCache: boolean;
  backgroundPlayback: boolean;
  prevRestartThresholdSec?: number; // threshold in seconds (default: 3) to restart song vs navigate to previous
  adaptiveBitrate?: boolean;
  prebufferNextTrack?: boolean;
  streamingProtocol?: StreamingProtocol;
}
