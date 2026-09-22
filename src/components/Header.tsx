import React from 'react';
import { Settings } from 'lucide-react';
import { ActiveScreen } from '../types';

interface HeaderProps {
  activeScreen: ActiveScreen;
  userName?: string;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeScreen,
  userName: _userName,
  onOpenHistory: _onOpenHistory,
  onOpenSettings
}) => {
  const getScreenTitle = () => {
    switch (activeScreen) {
      case 'home':
      case 'explore':
        return 'Explore Charts';
      case 'search':
        return 'Search Music';
      case 'library':
        return 'Your Library';
      case 'offline':
        return 'Offline Storage';
      case 'plugins':
        return 'Streamzy Plugins';
      case 'settings':
        return 'Preferences';
      default:
        return 'Music';
    }
  };

  return (
    <header id="app-header" className="fixed top-0 w-full z-40 pt-safe liquid-glass-heavy bg-[#0A040C]/90 backdrop-blur-md border-b border-[#231327]">
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-3 max-w-5xl mx-auto">
        {/* Logo and Brand Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-[0_0_16px_rgba(217,70,239,0.35)] shrink-0 border border-white/[0.08] flex items-center justify-center group cursor-pointer bg-black">
            <img
              src="/streamzy_logo.jpg"
              alt="Streamzy"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-[18px] tracking-tight text-white truncate leading-tight">
                Stream<span className="bg-gradient-to-r from-[#D946EF] via-[#A855F7] to-[#06B6D4] bg-clip-text text-transparent">zy</span>
              </span>
            </div>
            <span className="text-[11px] font-medium text-[#A193A5] capitalize leading-none truncate mt-0.5">
              {getScreenTitle()}
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Settings */}
          {onOpenSettings && (
            <button
              id="header-settings-btn"
              onClick={onOpenSettings}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg border border-white/10 cursor-pointer ${
                activeScreen === 'settings'
                  ? 'bg-[var(--color-primary)] text-white shadow-[0_0_14px_var(--dynamic-glow,rgba(254,56,94,0.4))]'
                  : 'bg-white/5 hover:bg-white/10 text-white/80'
              }`}
              title="App Settings"
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
