import React, { useState, useMemo, useEffect } from 'react';
import { Track, UserSignal, TrackScoreBreakdown, RecommendationWeights, RecommendationScoreBreakdown } from '../types';
import { TRACKS } from '../data/musicData';
import { personalizationService, SIGNAL_WEIGHTS } from '../services/personalizationService';
import { TrackImage } from './TrackImage';

interface PersonalizationInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack?: Track | null;
  onSelectTrack?: (track: Track) => void;
}

export const PersonalizationInspectorModal: React.FC<PersonalizationInspectorModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  onSelectTrack
}) => {
  const [activeTab, setActiveTab] = useState<'breakdown' | 'weights' | 'signals' | 'affinities'>('breakdown');
  const [selectedTrackForScore, setSelectedTrackForScore] = useState<Track>(currentTrack || TRACKS[0]);
  const [tick, setTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsub = personalizationService.subscribe(() => setTick((t) => t + 1));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (currentTrack) {
      setSelectedTrackForScore(currentTrack);
    }
  }, [currentTrack]);

  const tasteSummary = useMemo(() => personalizationService.getTasteSummary(), [tick]);
  const recentSignals = useMemo(() => personalizationService.getRecentSignals(40), [tick]);
  const currentWeights = useMemo(() => personalizationService.getRecommendationWeights(), [tick]);

  const recommendationBreakdown: RecommendationScoreBreakdown = useMemo(() => {
    return personalizationService.calculateRecommendationScore(selectedTrackForScore);
  }, [selectedTrackForScore, tick, currentWeights]);

  const handleWeightChange = (key: keyof RecommendationWeights, value: number) => {
    personalizationService.setRecommendationWeights({ [key]: value });
    setTick((t) => t + 1);
  };

  const handleResetWeights = () => {
    personalizationService.resetRecommendationWeights();
    setTick((t) => t + 1);
  };

  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return TRACKS.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return TRACKS.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.genre && t.genre.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [searchQuery]);

  if (!isOpen) return null;

  const getSignalBadgeColor = (type: UserSignal['type'], delta: number) => {
    if (delta > 30) return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
    if (delta > 0) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (delta < -20) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (delta < 0) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
  };

  const getSignalIcon = (type: UserSignal['type']) => {
    switch (type) {
      case 'like':
      case 'favorite':
        return 'favorite';
      case 'unlike':
      case 'unfavorite':
        return 'heart_broken';
      case 'replay':
        return 'replay';
      case 'play_completed':
        return 'task_alt';
      case 'play_started':
        return 'play_circle';
      case 'skip':
        return 'skip_next';
      case 'search':
        return 'search';
      case 'song_selected':
        return 'touch_app';
      case 'album_selected':
        return 'album';
      case 'artist_selected':
        return 'person';
      case 'playlist_selected':
        return 'queue_music';
      case 'listening_duration':
        return 'timer';
      default:
        return 'analytics';
    }
  };

  const formatTimestamp = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="personalization-inspector-modal"
        className="relative w-full max-w-2xl max-h-[90vh] bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-pink-500 flex items-center justify-center text-black shadow-lg">
              <span className="material-symbols-outlined floating-icon text-[20px]">
                psychology
              </span>
            </div>
            <div>
              <h2 className="text-[17px] font-black text-white tracking-tight flex items-center gap-2">
                Personalization Engine
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30 font-bold uppercase tracking-wider">
                  Transparent Scoring
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">
                Live signal tracking & weighted preference model
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined floating-icon text-[18px]">close</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 bg-white/[0.01] border-b border-white/5 overflow-x-auto no-scrollbar">
          {[
            { id: 'breakdown', label: 'Recommendation Scoring', icon: 'calculate' },
            { id: 'weights', label: 'Configurable Weights', icon: 'tune' },
            { id: 'signals', label: 'Signal Feed', icon: 'timeline', count: recentSignals.length },
            { id: 'affinities', label: 'Top Preferences', icon: 'bar_chart' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="material-symbols-outlined floating-icon text-[15px]">
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-zinc-800 text-zinc-300">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-zinc-300 text-[13px] no-scrollbar">
          {/* TAB 1: SIGNAL FEED */}
          {activeTab === 'signals' && (
            <div className="space-y-3 animate-fade-in">
              {/* Summary stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold">Total Listens</span>
                  <span className="text-[18px] font-black text-white mt-0.5">{tasteSummary.totalListens}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold">Completed Plays</span>
                  <span className="text-[18px] font-black text-emerald-300 mt-0.5">{tasteSummary.completedPlays}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col">
                  <span className="text-[10px] text-pink-400 uppercase font-semibold">Likes / Favs</span>
                  <span className="text-[18px] font-black text-pink-300 mt-0.5">{tasteSummary.totalLikes}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col">
                  <span className="text-[10px] text-red-400 uppercase font-semibold">Immediate Skips</span>
                  <span className="text-[18px] font-black text-red-300 mt-0.5">{tasteSummary.immediateSkips}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <h3 className="text-[14px] font-bold text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined floating-icon text-[16px] text-[var(--color-primary)]">
                    sensors
                  </span>
                  Recent Signal Stream
                </h3>
                <span className="text-[11px] text-zinc-500">Live tracked events</span>
              </div>

              {recentSignals.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                  <span className="material-symbols-outlined floating-icon text-[32px] text-zinc-600">
                    multitrack_audio
                  </span>
                  <p className="text-[13px] text-zinc-400 font-medium">No signals recorded in this session yet.</p>
                  <p className="text-[11px] text-zinc-500">
                    Play songs, skip, like, search, or explore albums to watch signals register in real-time.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentSignals.map((signal) => (
                    <div
                      key={signal.id}
                      className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 flex items-start justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border ${getSignalBadgeColor(
                            signal.type,
                            signal.weightDelta
                          )}`}
                        >
                          <span className="material-symbols-outlined floating-icon text-[15px]">
                            {getSignalIcon(signal.type)}
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-bold text-white truncate">
                              {signal.trackTitle || signal.artist || signal.album || signal.searchQuery || signal.playlistTitle || signal.type}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
                              {signal.type.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                            {signal.description}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        <span
                          className={`text-[12px] font-black px-2 py-0.5 rounded-full border ${getSignalBadgeColor(
                            signal.type,
                            signal.weightDelta
                          )}`}
                        >
                          {signal.weightDelta > 0 ? `+${signal.weightDelta}` : signal.weightDelta} pts
                        </span>
                        <span className="text-[10px] text-zinc-500 mt-1 font-mono">
                          {formatTimestamp(signal.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TOP AFFINITIES */}
          {activeTab === 'affinities' && (
            <div className="space-y-4 animate-fade-in">
              {/* Active Vibe & Onboarding State */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-zinc-900 to-zinc-950 border border-purple-500/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                    <span className="material-symbols-outlined floating-icon text-[22px]">
                      graphic_eq
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">
                      Current Listening Vibe
                    </span>
                    <h4 className="text-[15px] font-black text-white">{tasteSummary.activeVibe}</h4>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to reset your personalization profile?')) {
                      personalizationService.resetTasteProfile();
                      setTick((t) => t + 1);
                    }
                  }}
                  className="px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Reset Profile
                </button>
              </div>

              {/* Top Artists with Skip Streak Penalties */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-bold text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined floating-icon text-[16px] text-purple-400">
                      person
                    </span>
                    Top Artists & Recommendation Weights
                  </h3>
                  <span className="text-[11px] text-zinc-500">Calculated from plays, likes & skips</span>
                </div>

                {tasteSummary.topArtists.length === 0 ? (
                  <p className="text-[12px] text-zinc-500 italic p-3">No artist affinities recorded yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {tasteSummary.topArtists.map((art) => (
                      <div
                        key={art.name}
                        className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-2"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-bold text-white truncate">{art.name}</span>
                          {art.skipStreak >= 2 ? (
                            <span className="text-[10px] text-red-400 font-semibold flex items-center gap-1 mt-0.5">
                              <span className="material-symbols-outlined floating-icon text-[12px]">warning</span>
                              {art.skipStreak} consecutive skips (weight reduced)
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                              Active preference
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-mono font-black text-purple-300">
                            {art.score} pts
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Genres */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-bold text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined floating-icon text-[16px] text-cyan-400">
                      category
                    </span>
                    Top Genres & Categories
                  </h3>
                  <span className="text-[11px] text-zinc-500">Acoustic affinity</span>
                </div>

                {tasteSummary.topGenres.length === 0 ? (
                  <p className="text-[12px] text-zinc-500 italic p-3">No genre affinities recorded yet.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {tasteSummary.topGenres.map((gen) => (
                      <div
                        key={gen.genre}
                        className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-between"
                      >
                        <span className="text-[12px] font-bold text-white capitalize truncate">{gen.genre}</span>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[12px] font-mono font-black text-cyan-300">{gen.score} pts</span>
                          {gen.skipStreak >= 2 && (
                            <span className="text-[9px] text-red-400 font-bold">-{gen.skipStreak * 8}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: RECOMMENDATION SCORING BREAKDOWN */}
          {activeTab === 'breakdown' && (
            <div className="space-y-4 animate-fade-in">
              {/* Formula Card */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-zinc-950 border border-blue-500/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black tracking-wider uppercase text-blue-400">
                    Centralized Scoring Formula
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">Normalized (0 - 100%)</span>
                </div>
                <div className="text-[11px] font-mono text-zinc-300 bg-black/40 p-2.5 rounded-xl border border-white/5 overflow-x-auto whitespace-nowrap">
                  <span className="text-emerald-400">score</span> = similarity + artistPref + genrePref + langPref + popularity + history + like + context <span className="text-red-400">- recentPenalty - dupPenalty - skipPenalty</span>
                </div>
              </div>

              {/* Song Selector */}
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-white flex items-center justify-between">
                  <span>Target Candidate Song:</span>
                  <span className="text-[11px] text-zinc-400">Pick any track from catalog</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search song to calculate recommendation score..."
                    className="w-full h-10 px-3 pl-9 rounded-xl bg-white/[0.06] border border-white/10 text-[13px] text-white placeholder:text-zinc-500 focus:outline-none focus:border-[var(--color-primary)]"
                  />
                  <span className="material-symbols-outlined floating-icon text-zinc-400 text-[18px] absolute left-2.5 top-2.5">
                    search
                  </span>
                </div>

                {/* Candidate Track Pills */}
                <div className="flex gap-2 overflow-x-auto py-1 no-scrollbar">
                  {filteredCatalog.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTrackForScore(t)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-[12px] font-semibold transition-all cursor-pointer shrink-0 ${
                        selectedTrackForScore.id === t.id
                          ? 'bg-[var(--color-primary)] text-black border-[var(--color-primary)] font-bold'
                          : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <TrackImage className="w-5 h-5 rounded-md object-cover" src={t.coverUrl} videoId={t.videoId} alt={t.title} />
                      <span className="truncate max-w-[120px]">{t.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Track & Total Scores */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <TrackImage
                    className="w-14 h-14 rounded-2xl object-cover shadow-lg border border-white/10 shrink-0"
                    src={selectedTrackForScore.coverUrl}
                    videoId={selectedTrackForScore.videoId}
                    alt={selectedTrackForScore.title}
                  />
                  <div className="flex flex-col min-w-0">
                    <h4 className="text-[15px] font-black text-white truncate">{selectedTrackForScore.title}</h4>
                    <span className="text-[12px] text-zinc-400 truncate">{selectedTrackForScore.artist}</span>
                    <span className="text-[10px] text-zinc-500 uppercase font-mono mt-0.5">
                      {selectedTrackForScore.genre || 'Music'} • {selectedTrackForScore.language || 'Hindi'} • {selectedTrackForScore.duration}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Recommendation Score</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-[24px] font-black font-mono ${recommendationBreakdown.normalizedScore >= 60 ? 'text-emerald-400' : recommendationBreakdown.normalizedScore >= 30 ? 'text-amber-400' : 'text-zinc-400'}`}>
                      {recommendationBreakdown.normalizedScore}%
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      ({recommendationBreakdown.recommendationScore} raw pts)
                    </span>
                  </div>
                </div>
              </div>

              {/* 11 Component Score Breakdown Grid */}
              <div className="space-y-2">
                <h4 className="text-[13px] font-bold text-white flex items-center justify-between">
                  <span>11-Factor Component Scores:</span>
                  <span className="text-[11px] text-zinc-400">Sum of components minus penalties</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                    <span className="text-[11px] text-zinc-400">Similarity</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[13px] font-mono font-bold text-blue-400">+{recommendationBreakdown.similarityScore}</span>
                      <span className="text-[9px] text-zinc-500">wt: {currentWeights.similarityWeight}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                    <span className="text-[11px] text-zinc-400">Artist Pref</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[13px] font-mono font-bold text-purple-400">+{recommendationBreakdown.artistPreferenceScore}</span>
                      <span className="text-[9px] text-zinc-500">wt: {currentWeights.artistPreferenceWeight}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                    <span className="text-[11px] text-zinc-400">Genre Pref</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[13px] font-mono font-bold text-cyan-400">+{recommendationBreakdown.genrePreferenceScore}</span>
                      <span className="text-[9px] text-zinc-500">wt: {currentWeights.genrePreferenceWeight}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                    <span className="text-[11px] text-zinc-400">Language Pref</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[13px] font-mono font-bold text-indigo-400">+{recommendationBreakdown.languagePreferenceScore}</span>
                      <span className="text-[9px] text-zinc-500">wt: {currentWeights.languagePreferenceWeight}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                    <span className="text-[11px] text-zinc-400">Popularity</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[13px] font-mono font-bold text-zinc-300">+{recommendationBreakdown.popularityScore}</span>
                      <span className="text-[9px] text-zinc-500">wt: {currentWeights.popularityWeight}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                    <span className="text-[11px] text-zinc-400">History & Replay</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[13px] font-mono font-bold text-emerald-400">+{recommendationBreakdown.historyScore}</span>
                      <span className="text-[9px] text-zinc-500">wt: {currentWeights.historyWeight}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                    <span className="text-[11px] text-zinc-400">Like / Favorite</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[13px] font-mono font-bold text-pink-400">+{recommendationBreakdown.likeScore}</span>
                      <span className="text-[9px] text-zinc-500">wt: {currentWeights.likeWeight}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                    <span className="text-[11px] text-zinc-400">Context & Time</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[13px] font-mono font-bold text-amber-400">+{recommendationBreakdown.contextScore}</span>
                      <span className="text-[9px] text-zinc-500">wt: {currentWeights.contextWeight}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-500/20 flex flex-col justify-between">
                    <span className="text-[11px] text-red-300">Recent Play Penalty</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[13px] font-mono font-bold text-red-400">-{recommendationBreakdown.recentPlayPenalty}</span>
                      <span className="text-[9px] text-zinc-500">wt: {currentWeights.recentPlayPenaltyWeight}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-500/20 flex flex-col justify-between">
                    <span className="text-[11px] text-red-300">Duplicate Penalty</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[13px] font-mono font-bold text-red-400">-{recommendationBreakdown.duplicatePenalty}</span>
                      <span className="text-[9px] text-zinc-500">wt: {currentWeights.duplicatePenaltyWeight}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-500/20 flex flex-col justify-between col-span-2 sm:col-span-2">
                    <span className="text-[11px] text-red-300">Skip & Streak Penalty</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[13px] font-mono font-bold text-red-400">-{recommendationBreakdown.skipPenalty}</span>
                      <span className="text-[9px] text-zinc-500">wt: {currentWeights.skipPenaltyWeight}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itemized Calculation Factors List */}
              <div className="space-y-2 pt-1">
                <h4 className="text-[13px] font-bold text-white">Transparent Calculation Factors:</h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                  {recommendationBreakdown.factors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 px-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-3"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12px] font-bold text-white truncate">{factor.name}</span>
                        <span className="text-[10px] text-zinc-400 line-clamp-1">{factor.description}</span>
                      </div>
                      <span
                        className={`text-[12px] font-mono font-bold px-2 py-0.5 rounded-md ${
                          factor.points > 0
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : factor.points < 0
                            ? 'text-red-400 bg-red-500/10'
                            : 'text-zinc-400 bg-zinc-800'
                        }`}
                      >
                        {factor.points > 0 ? `+${factor.points}` : factor.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {onSelectTrack && (
                <button
                  onClick={() => {
                    onSelectTrack(selectedTrackForScore);
                    onClose();
                  }}
                  className="w-full py-2.5 rounded-2xl bg-[var(--color-primary)] text-black font-bold text-[13px] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <span className="material-symbols-outlined floating-icon text-[18px]">play_arrow</span>
                  Play Selected Song
                </button>
              )}
            </div>
          )}

          {/* TAB 2: CONFIGURABLE WEIGHTS */}
          {activeTab === 'weights' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[14px] font-bold text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined floating-icon text-[16px] text-[var(--color-primary)]">
                      tune
                    </span>
                    Central Recommendation Weights
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Adjust individual scoring factor weights to fine-tune the recommendation engine in real time.
                  </p>
                </div>
                <button
                  onClick={handleResetWeights}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white border border-white/10 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>

              {/* Sliders Grid */}
              <div className="space-y-3">
                {[
                  {
                    key: 'similarityWeight' as const,
                    label: 'Similarity Weight',
                    desc: 'Acoustic vector, harmonic & metadata similarity to seed tracks',
                    min: 0,
                    max: 50,
                    color: 'accent-blue-500'
                  },
                  {
                    key: 'artistPreferenceWeight' as const,
                    label: 'Artist Preference Weight',
                    desc: 'Affinities computed from frequent listens, likes & selections',
                    min: 0,
                    max: 50,
                    color: 'accent-purple-500'
                  },
                  {
                    key: 'genrePreferenceWeight' as const,
                    label: 'Genre Preference Weight',
                    desc: 'User category & vibe alignment across listening habits',
                    min: 0,
                    max: 40,
                    color: 'accent-cyan-500'
                  },
                  {
                    key: 'languagePreferenceWeight' as const,
                    label: 'Language Preference Weight',
                    desc: 'Alignment with user preferred language distributions',
                    min: 0,
                    max: 30,
                    color: 'accent-indigo-500'
                  },
                  {
                    key: 'popularityWeight' as const,
                    label: 'Popularity Weight',
                    desc: 'Global streaming volume and trending catalog baseline',
                    min: 0,
                    max: 30,
                    color: 'accent-zinc-400'
                  },
                  {
                    key: 'historyWeight' as const,
                    label: 'History & Replay Weight',
                    desc: 'Rewards tracks with repeated loops and proven play counts',
                    min: 0,
                    max: 40,
                    color: 'accent-emerald-500'
                  },
                  {
                    key: 'likeWeight' as const,
                    label: 'Like / Favorite Weight',
                    desc: 'Strong positive boost for thumbs-up and favorited tracks',
                    min: 0,
                    max: 50,
                    color: 'accent-pink-500'
                  },
                  {
                    key: 'contextWeight' as const,
                    label: 'Context & Time-of-Day Weight',
                    desc: 'Daypart listening habits (morning/afternoon/night) and recent search queries',
                    min: 0,
                    max: 30,
                    color: 'accent-amber-500'
                  },
                  {
                    key: 'recentPlayPenaltyWeight' as const,
                    label: 'Recent Play Penalty Weight',
                    desc: 'Cooldown penalty on songs played very recently in session',
                    min: 0,
                    max: 50,
                    color: 'accent-red-500'
                  },
                  {
                    key: 'duplicatePenaltyWeight' as const,
                    label: 'Duplicate Penalty Weight',
                    desc: 'Penalty applied to already-queued or duplicate version tracks',
                    min: 0,
                    max: 60,
                    color: 'accent-rose-500'
                  },
                  {
                    key: 'skipPenaltyWeight' as const,
                    label: 'Skip Penalty Weight',
                    desc: 'Penalty applied to early skips and consecutive artist/genre skip streaks',
                    min: 0,
                    max: 50,
                    color: 'accent-red-600'
                  }
                ].map((item) => (
                  <div
                    key={item.key}
                    className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-white">{item.label}</span>
                        <span className="text-[11px] text-zinc-400">{item.desc}</span>
                      </div>
                      <span className="text-[14px] font-mono font-black text-white shrink-0 ml-3">
                        {currentWeights[item.key]} pts
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={item.min}
                        max={item.max}
                        step={1}
                        value={currentWeights[item.key]}
                        onChange={(e) => handleWeightChange(item.key, parseFloat(e.target.value))}
                        className={`w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer ${item.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-mono">
            VD Centralized Recommendation Engine • v2.5
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-white text-black font-bold text-[12px] hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
