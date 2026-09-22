import React from 'react';
import { Settings, Cloud } from 'lucide-react';
import { ActiveScreen } from '../types';

interface HeaderProps {
  activeScreen: ActiveScreen;
  userName?: string;
  onOpenAccountSync: () => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeScreen,
  userName,
  onOpenAccountSync,
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

  const getUserInitials = (name: string) => {
    if (!name) return '';
    return name.substring(0, 2).toUpperCase();
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
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg border border-[#301B34] cursor-pointer ${
                activeScreen === 'settings'
                  ? 'bg-[#FE385E] text-white'
                  : 'bg-[#180E1B] hover:bg-[#2A162D] text-[#DAEAF7]'
              }`}
              title="App Settings"
            >
              <Settings size={18} />
            </button>
          )}

          {/* Account Profile / Sync Button */}
          <button
            id="header-account-btn"
            aria-label="Account & Sync"
            onClick={onOpenAccountSync}
            className="relative w-9 h-9 rounded-xl bg-[#FE385E] text-white flex items-center justify-center shadow-[0_0_14px_rgba(254,56,94,0.4)] hover:brightness-110 active:scale-95 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg shrink-0 ml-1 cursor-pointer font-bold text-[12px]"
            title="Cloud Sync"
          >
            {userName ? (
              <span>{getUserInitials(userName)}</span>
            ) : (
              <Cloud size={17} />
            )}
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-black"
              title="Online"
            />
          </button>
        </div>
      </div>
    </header>
  );
};
