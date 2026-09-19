import React, { useState } from 'react';
import { OPENTUNE_LOGO_URL } from '../data/musicData';

interface PlanScreenProps {
  onComplete: (name: string) => void;
}

export const PlanScreen: React.FC<PlanScreenProps> = ({ onComplete }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onComplete(name.trim());
    }
  };

  return (
    <div
      id="welcome-name-modal-overlay"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in select-none"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.68)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      {/* Modal Card Container: 100% opaque to prevent background UI bleed-through */}
      <div
        id="welcome-name-card"
        className="relative z-10 w-full max-w-[380px] bg-[#121216] border border-white/10 rounded-[28px] p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] flex flex-col items-center text-center my-auto transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Streamzy Logo */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 mb-5 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_0_24px_rgba(248,113,113,0.25)] border border-white/10 p-1 flex items-center justify-center bg-black shrink-0">
          <img 
            alt="Streamzy" 
            src="/streamzy_logo.jpg" 
            className="w-full h-full object-cover rounded-[14px] sm:rounded-[20px]" 
          />
        </div>
        
        {/* Title */}
        <h1 id="welcome-title" className="text-2xl sm:text-3xl font-extrabold text-[#e4e1e7] mb-2 tracking-tight">
          Welcome to Stream<span className="bg-gradient-to-r from-[#D946EF] via-[#A855F7] to-[#06B6D4] bg-clip-text text-transparent">zy</span>
        </h1>

        {/* Subtitle */}
        <p id="welcome-subtitle" className="text-[#a1a1aa] mb-6 text-[14px] sm:text-[15px] leading-relaxed">
          Before we start playing your favorite tunes, what should we call you?
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col text-left">
            <label
              htmlFor="user-name-input"
              className="text-[12px] font-semibold text-[#a1a1aa] uppercase tracking-wider mb-2 ml-1"
            >
              YOUR NAME
            </label>
            <input
              id="user-name-input"
              type="text"
              placeholder="e.g. Vicky"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-3.5 sm:py-4 text-[#e4e1e7] placeholder-[#a1a1aa]/40 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all text-[16px]"
              autoFocus
              maxLength={25}
              autoComplete="name"
            />
          </div>

          <button
            id="welcome-lets-go-btn"
            type="submit"
            disabled={!name.trim()}
            className="w-full py-3.5 sm:py-4 mt-1 rounded-2xl bg-[var(--color-primary)] text-[#670211] font-bold text-[16px] disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_20px_rgba(248,113,113,0.3)] cursor-pointer"
          >
            Let's Go
          </button>
        </form>
      </div>
    </div>
  );
};

