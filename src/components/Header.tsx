import React from 'react';
import { Settings } from 'lucide-react';
import { ActiveScreen } from '../types';

interface HeaderProps {
  activeScreen: ActiveScreen;
  userName?: string;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
}

const HeaderComponent: React.FC<HeaderProps> = ({
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
    <header
      id="app-header"
      className="fixed top-0 inset-x-0 z-40 pt-[env(safe-area-inset-top,0px)] bg-black/40 backdrop-blur-xl border-none transition-colors duration-200"
    >
      <div className="h-14 px-4 sm:px-6 flex items-center justify-between gap-3 max-w-5xl mx-auto">
        {/* Logo and Brand Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-white/10 flex items-center justify-center bg-zinc-950 shadow-[0_0_12px_rgba(217,70,239,0.2)] group cursor-pointer">
            <img
              src="/streamzy_logo.jpg"
              alt="Streamzy"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col min-w-0 justify-center">
            <div className="flex items-center leading-none">
              <span className="font-bold text-[15px] sm:text-[16px] tracking-tight text-white truncate">
                Stream<span className="bg-gradient-to-r from-[#D946EF] via-[#C084FC] to-[#06B6D4] bg-clip-text text-transparent">zy</span>
              </span>
            </div>
            <span className="text-[10px] sm:text-[10.5px] font-medium text-zinc-400 capitalize leading-none truncate mt-1">
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
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 border cursor-pointer ${
                activeScreen === 'settings'
                  ? 'bg-[var(--color-primary)] text-white border-transparent shadow-[0_0_12px_var(--dynamic-glow,rgba(254,56,94,0.35))]'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border-white/10'
              }`}
              title="App Settings"
            >
              <Settings size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export const Header = React.memo(HeaderComponent);
