import React, { useState, useEffect } from 'react';
import { realtimeSyncService, SyncStatus } from '../services/realtimeSyncService';
import { authClient, AuthUser } from '../services/authClient';

interface AccountSyncModalProps {
  userName?: string;
  onClose: () => void;
  onOpenSettings: () => void;
}

export const AccountSyncModal: React.FC<AccountSyncModalProps> = ({
  userName: initialUserName,
  onClose,
  onOpenSettings
}) => {
  const [cacheCleared, setCacheCleared] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(realtimeSyncService.getStatus());
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(authClient.getUser());
  const [isEditingName, setIsEditingName] = useState(false);
  const [authMode, setAuthMode] = useState<'profile' | 'login' | 'register'>('profile');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const unsubSync = realtimeSyncService.onStatusChanged((s) => setSyncStatus(s));
    const unsubAuth = authClient.onAuthChange((user) => {
      setCurrentUser(user);
    });

    return () => {
      unsubSync();
      unsubAuth();
    };
  }, []);

  const handleClearCache = () => {
    try {
      localStorage.removeItem('vd_audio_cache');
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      await authClient.login(emailInput, passwordInput);
      setAuthMode('profile');
      setEmailInput('');
      setPasswordInput('');
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      await authClient.register(emailInput, passwordInput, nameInput || 'Music Lover');
      setAuthMode('profile');
      setEmailInput('');
      setPasswordInput('');
      setNameInput('');
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await authClient.logout();
  };

  const handleUpdateName = (newName: string) => {
    if (!newName.trim()) return;
    try {
      localStorage.setItem('vd_user_name', newName.trim());
      setIsEditingName(false);
    } catch {
      // Ignore
    }
  };

  const effectiveName = currentUser?.displayName || initialUserName || 'Music Lover';

  const getUserInitials = (name?: string) => {
    if (!name) return 'VD';
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div 
      id="profile-modal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Modal Frame */}
      <div 
        className="flex flex-col w-full max-w-md liquid-glass rounded-3xl shadow-2xl overflow-hidden border border-white/[0.08] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 liquid-glass/70 backdrop-blur-md border-b border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <span 
              className="material-symbols-outlined text-[var(--color-primary)] text-[22px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              account_circle
            </span>
            <span className="text-[17px] font-bold text-[#e4e1e7] tracking-tight">
              User Profile
            </span>
          </div>

          <button 
            id="close-profile-modal-btn"
            aria-label="Close modal"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.15] text-[#a1a1aa] hover:text-[#e4e1e7] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {authMode === 'profile' ? (
            <>
              {/* User Profile Banner */}
              <div className="relative overflow-hidden bg-gradient-to-br from-[#2a1a2e] to-[#160c19] rounded-2xl p-4 border border-[#FE385E]/20 shadow-md">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FE385E] to-[#891933] flex items-center justify-center text-white shrink-0 shadow-lg ring-2 ring-white/20">
                    <span className="font-bold text-[20px] tracking-widest">{getUserInitials(effectiveName)}</span>
                  </div>
                  
                  <div className="flex flex-col min-w-0 flex-1">
                    {isEditingName ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          defaultValue={effectiveName}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateName(e.currentTarget.value);
                            if (e.key === 'Escape') setIsEditingName(false);
                          }}
                          onBlur={(e) => handleUpdateName(e.target.value)}
                          className="px-2 py-1 rounded bg-black/60 border border-white/20 text-white text-[14px] font-bold focus:outline-none focus:border-[#FE385E] w-full"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[17px] font-bold text-white truncate">
                          {effectiveName}
                        </span>
                        <button
                          onClick={() => setIsEditingName(true)}
                          className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                          title="Edit Name"
                        >
                          <span className="material-symbols-outlined text-[15px]">edit</span>
                        </button>
                      </div>
                    )}
                    <span className="text-[12px] text-zinc-300 truncate mt-0.5">
                      {currentUser?.email || 'Streamzy Member'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/[0.08] text-[11px] text-zinc-300">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Cloud Sync Active</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-emerald-400 text-[14px]">verified</span>
                    <span>High Fidelity Audio</span>
                  </div>
                </div>
              </div>

              {/* Account Actions */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAuthMode('login')}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 text-[13px] font-medium border border-white/[0.08] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">login</span>
                    <span>Switch Account</span>
                  </button>
                  <button
                    onClick={() => setAuthMode('register')}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 text-[13px] font-medium border border-white/[0.08] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    <span>Sign Up</span>
                  </button>
                </div>

                {currentUser && (
                  <button
                    onClick={handleLogout}
                    className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 text-[12px] font-medium border border-red-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            </>
          ) : authMode === 'login' ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-white">Sign In</span>
                <button 
                  type="button" 
                  onClick={() => setAuthMode('profile')} 
                  className="text-[12px] text-zinc-400 hover:text-white cursor-pointer"
                >
                  Back
                </button>
              </div>

              {authError && (
                <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-[12px]">
                  {authError}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-zinc-400 font-medium">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="listener@music.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-white text-[13px] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-zinc-400 font-medium">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-white text-[13px] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="mt-2 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-[13px] font-bold hover:brightness-110 active:scale-98 transition-all cursor-pointer"
              >
                {authLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-white">Create Account</span>
                <button 
                  type="button" 
                  onClick={() => setAuthMode('profile')} 
                  className="text-[12px] text-zinc-400 hover:text-white cursor-pointer"
                >
                  Back
                </button>
              </div>

              {authError && (
                <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-[12px]">
                  {authError}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-zinc-400 font-medium">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="Your Name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-white text-[13px] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-zinc-400 font-medium">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="you@domain.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-white text-[13px] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-zinc-400 font-medium">Password (min 6 characters)</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-black/40 border border-white/[0.1] text-white text-[13px] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="mt-2 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-[13px] font-bold hover:brightness-110 active:scale-98 transition-all cursor-pointer"
              >
                {authLoading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </form>
          )}

          {/* Quick Preferences & Cache Utilities */}
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.08] text-[12px]">
            <button 
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">settings</span>
              <span>Preferences</span>
            </button>

            <button 
              onClick={handleClearCache}
              disabled={cacheCleared}
              className="flex items-center gap-1 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">cached</span>
              <span>{cacheCleared ? 'Cache Cleared' : 'Clear Cache'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
