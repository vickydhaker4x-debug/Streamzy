import React from 'react';
import { motion } from 'motion/react';
import { Compass, Search, Library } from 'lucide-react';
import { ActiveScreen } from '../types';

interface BottomNavProps {
  activeScreen: ActiveScreen;
  onSelectScreen: (screen: ActiveScreen) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeScreen,
  onSelectScreen
}) => {
  const tabs = [
    { id: 'home' as ActiveScreen, label: 'Explore', Icon: Compass },
    { id: 'search' as ActiveScreen, label: 'Search', Icon: Search },
    { id: 'library' as ActiveScreen, label: 'Library', Icon: Library }
  ];

  return (
    <nav 
      id="bottom-navigation"
      className="fixed bottom-0 w-full z-40 pb-safe liquid-glass-heavy border-t border-white/[0.08] shadow-[0_-8px_32px_rgba(0,0,0,0.5)] gpu-layer"
    >
      <div className="h-16 px-4 flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeScreen === tab.id;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onSelectScreen(tab.id)}
              className={`relative flex flex-col items-center justify-center min-w-[72px] h-12 rounded-xl transition-all duration-300 active:scale-95 cursor-pointer hover:-translate-y-0.5 ${
                isActive 
                  ? 'text-[var(--color-primary)] font-bold' 
                  : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-white/[0.04]'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 rounded-xl bg-[var(--color-primary)]/[0.12] border border-[var(--color-primary)]/25 -z-10 shadow-[0_0_16px_rgba(254,56,94,0.18)]"
                  transition={{ type: 'spring', damping: 26, stiffness: 350 }}
                />
              )}
              <Icon 
                size={22} 
                className={`transition-transform duration-200 ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-[1.8]'}`}
              />
              <span className="text-[11px] font-semibold mt-0.5 tracking-tight">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
