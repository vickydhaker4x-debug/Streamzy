import React, { useState } from 'react';
import { personalizationService } from '../services/personalizationService';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const AVAILABLE_GENRES = [
  { id: 'bollywood', label: 'Bollywood Romance', icon: 'favorite', color: 'from-rose-500/20 to-orange-500/20' },
  { id: 'punjabi', label: 'Punjabi Pop & Beats', icon: 'local_fire_department', color: 'from-amber-500/20 to-red-500/20' },
  { id: 'electronic', label: 'High-Energy EDM', icon: 'bolt', color: 'from-cyan-500/20 to-blue-500/20' },
  { id: 'chillout', label: 'Midnight Lo-Fi & Chill', icon: 'bedtime', color: 'from-indigo-500/20 to-purple-500/20' },
  { id: 'hiphop', label: 'Urban Hip-Hop & Trap', icon: 'headphones', color: 'from-yellow-500/20 to-orange-500/20' },
  { id: 'pop', label: 'Global Pop & Trending Hits', icon: 'star', color: 'from-pink-500/20 to-rose-500/20' },
  { id: 'indie', label: 'Indie & Acoustic', icon: 'graphic_eq', color: 'from-emerald-500/20 to-teal-500/20' }
];

const CURATED_ARTISTS = [
  { name: 'Arijit Singh', genre: 'Bollywood', img: 'https://i.ytimg.com/vi/BddP6PYo2gs/mqdefault.jpg' },
  { name: 'Sidhu Moosewala', genre: 'Punjabi', img: 'https://i.ytimg.com/vi/n_FCrCQ6-9U/mqdefault.jpg' },
  { name: 'AP Dhillon', genre: 'Punjabi', img: 'https://i.ytimg.com/vi/VNs_cCtdbPc/mqdefault.jpg' },
  { name: 'The Weeknd', genre: 'Global Pop', img: 'https://i.ytimg.com/vi/34Na4j8AVgA/mqdefault.jpg' },
  { name: 'Pritam', genre: 'Bollywood', img: 'https://i.ytimg.com/vi/sK7riqg2mr4/mqdefault.jpg' },
  { name: 'Alan Walker', genre: 'EDM', img: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/mqdefault.jpg' },
  { name: 'Diljit Dosanjh', genre: 'Punjabi', img: 'https://i.ytimg.com/vi/p8gq-PqMv2c/mqdefault.jpg' },
  { name: 'Shreya Ghoshal', genre: 'Soulful', img: 'https://i.ytimg.com/vi/BddP6PYo2gs/mqdefault.jpg' },
  { name: 'Karan Aujla', genre: 'Punjabi', img: 'https://i.ytimg.com/vi/qfZm277B1iI/mqdefault.jpg' },
  { name: 'Taylor Swift', genre: 'Pop', img: 'https://i.ytimg.com/vi/60ItHLz5WEA/mqdefault.jpg' },
  { name: 'Darshan Raval', genre: 'Romance', img: 'https://i.ytimg.com/vi/l8Z3azp_qK8/mqdefault.jpg' },
  { name: 'Badshah', genre: 'Desi Rap', img: 'https://i.ytimg.com/vi/34Na4j8AVgA/mqdefault.jpg' }
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const profile = personalizationService.getProfile();
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() =>
    profile.favoriteGenres.length > 0 ? profile.favoriteGenres : ['bollywood', 'punjabi']
  );
  const [selectedArtists, setSelectedArtists] = useState<string[]>(() =>
    profile.favoriteArtists.length > 0 ? profile.favoriteArtists : ['Arijit Singh', 'Sidhu Moosewala']
  );
  const [artistFilter, setArtistFilter] = useState('');

  if (!isOpen) return null;

  const toggleGenre = (genreId: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId) ? prev.filter((g) => g !== genreId) : [...prev, genreId]
    );
  };

  const toggleArtist = (artistName: string) => {
    setSelectedArtists((prev) =>
      prev.includes(artistName) ? prev.filter((a) => a !== artistName) : [...prev, artistName]
    );
  };

  const handleSave = () => {
    const finalGenres = selectedGenres.length > 0 ? selectedGenres : ['bollywood', 'punjabi', 'pop'];
    const finalArtists = selectedArtists.length > 0 ? selectedArtists : ['Arijit Singh', 'AP Dhillon'];
    personalizationService.saveColdStartPreferences(finalGenres, finalArtists);
    onComplete();
    onClose();
  };

  const handleSkip = () => {
    personalizationService.saveColdStartPreferences(
      ['bollywood', 'punjabi', 'pop', 'electronic'],
      ['Arijit Singh', 'Sidhu Moosewala', 'The Weeknd']
    );
    onComplete();
    onClose();
  };

  const filteredArtists = CURATED_ARTISTS.filter((a) =>
    a.name.toLowerCase().includes(artistFilter.toLowerCase()) ||
    a.genre.toLowerCase().includes(artistFilter.toLowerCase())
  );

  return (
    <div
      id="onboarding-algorithm-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto"
    >
      <div
        className="w-full max-w-2xl bg-[#13131a] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-red-600/20 via-black to-zinc-900 flex items-start justify-between gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-bold text-red-400 uppercase tracking-widest">
                Cold Start Engine
              </span>
            </div>
            <h2 className="text-[22px] sm:text-[24px] font-black text-white tracking-tight leading-snug">
              Tune Your Music Algorithm
            </h2>
            <p className="text-[13px] text-zinc-300 mt-1 leading-relaxed">
              Select your favorite genres and artists to seed your personalized <strong>My Supermix</strong>, <strong>Discover Mix</strong>, and daily radio recommendations.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined floating-icon text-[18px]">close</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Section 1: Genres */}
          <div className="flex flex-col space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined floating-icon text-[18px] text-[var(--color-primary)]">
                  album
                </span>
                1. What genres move you?
              </span>
              <span className="text-[12px] font-medium text-zinc-400">
                {selectedGenres.length} selected
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {AVAILABLE_GENRES.map((genre) => {
                const isSelected = selectedGenres.includes(genre.id);
                return (
                  <button
                    key={genre.id}
                    onClick={() => toggleGenre(genre.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-red-500/20 border-red-500/50 text-white shadow-md'
                        : 'bg-white/[0.04] border-white/[0.06] text-zinc-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-red-500 text-white' : 'bg-white/10 text-zinc-300'
                    }`}>
                      <span className="material-symbols-outlined floating-icon text-[18px]">
                        {isSelected ? 'check' : genre.icon}
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold truncate leading-tight">
                      {genre.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Artists */}
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined floating-icon text-[18px] text-red-500">
                  person_celebrate
                </span>
                2. Which artists do you love?
              </span>
              <span className="text-[12px] font-medium text-zinc-400">
                {selectedArtists.length} selected (min 2 recommended)
              </span>
            </div>

            {/* Filter Input */}
            <div className="relative w-full">
              <input
                type="text"
                value={artistFilter}
                onChange={(e) => setArtistFilter(e.target.value)}
                placeholder="Search artists (e.g. Arijit, Sidhu, The Weeknd)..."
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2 text-[13px] text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
              />
              {artistFilter && (
                <button
                  onClick={() => setArtistFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <span className="material-symbols-outlined floating-icon text-[16px]">close</span>
                </button>
              )}
            </div>

            {/* Artists Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-56 overflow-y-auto pr-1">
              {filteredArtists.map((artist) => {
                const isSelected = selectedArtists.includes(artist.name);
                return (
                  <button
                    key={artist.name}
                    onClick={() => toggleArtist(artist.name)}
                    className={`flex flex-col items-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-red-500/15 border-red-500/60 shadow-lg'
                        : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.07]'
                    }`}
                  >
                    <div className="relative w-16 h-16 rounded-full overflow-hidden mb-2 border border-white/10 shrink-0">
                      <img
                        src={artist.img}
                        alt={artist.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className={`absolute inset-0 flex items-center justify-center transition-all ${
                        isSelected ? 'bg-red-600/70' : 'opacity-0 group-hover:opacity-40 bg-black'
                      }`}>
                        <span className="material-symbols-outlined floating-icon text-white text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          check
                        </span>
                      </div>
                    </div>
                    <span className="text-[12px] font-bold text-white truncate w-full">
                      {artist.name}
                    </span>
                    <span className="text-[10px] text-zinc-400 truncate w-full mt-0.5">
                      {artist.genre}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-black/40 flex items-center justify-between gap-3">
          <button
            onClick={handleSkip}
            className="text-xs text-zinc-400 hover:text-white font-semibold px-3 py-2 cursor-pointer transition-colors"
          >
            Use Popular Defaults
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white text-[13px] font-bold shadow-lg flex items-center gap-2 cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined floating-icon text-[18px]">
                auto_awesome
              </span>
              <span>Calibrate & Start Listening</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
