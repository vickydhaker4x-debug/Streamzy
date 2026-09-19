import React from 'react';
import { ActiveScreen } from '../types';

interface BottomNavProps {
  activeScreen: ActiveScreen;
  onSelectScreen: (screen: ActiveScreen) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeScreen,
  onSelectScreen
}) => {
  const tabs: { id: ActiveScreen; label: string; icon: string }[] = [
    { id: 'home', label: 'Explore', icon: 'explore' },
    { id: 'search', label: 'Search', icon: 'search' },
    { id: 'library', label: 'Library', icon: 'library_music' },
    { id: 'offline', label: 'Offline', icon: 'download_for_offline' }
  ];

  return (
    <nav 
      id="bottom-navigation"
      className="fixed bottom-0 w-full z-40 pb-safe liquid-glass-heavy"
    >
      <div className="h-16 px-4 flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeScreen === tab.id;
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onSelectScreen(tab.id)}
              className={`flex flex-col items-center justify-center min-w-[64px] h-12 transition-all active:scale-90 cursor-pointer ${
                isActive 
                  ? 'text-[var(--color-primary)] font-bold scale-105' 
                  : 'text-[#a1a1aa] hover:text-[#e4e1e7]'
              }`}
            >
              <span 
                className="material-symbols-outlined floating-icon text-[24px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {tab.icon}
              </span>
              <span className="text-[11px] font-semibold mt-1 tracking-tight">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
