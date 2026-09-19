import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, Smartphone, ShieldCheck, PowerOff, Sparkles, Check } from 'lucide-react';

interface BackgroundPermissionModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onDismiss: () => void;
}

export const BackgroundPermissionModal: React.FC<BackgroundPermissionModalProps> = ({
  isOpen,
  onAllow,
  onDismiss
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="vd-background-permission-backdrop"
        className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      >
        <motion.div
          id="vd-background-permission-dialog"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md liquid-glass-heavy border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl text-white relative overflow-hidden"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Header with App Logo */}
          <div className="flex flex-col items-center text-center mb-5">
            <div className="relative mb-3.5">
              <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-xl border-2 border-white/10 p-0.5 bg-black/40">
                <img 
                  src="/streamzy_logo.jpg" 
                  alt="Streamzy" 
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-black p-1 rounded-full border-2 border-[#18181f] shadow">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-emerald-400 mb-2">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Audiophile Background Service</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Enable Background Audio
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xs">
              Screen off hone par ya doosre apps use karte waqt bhi music play hota rahega.
            </p>
          </div>

          {/* Features Checklist */}
          <div className="space-y-2.5 mb-6">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="w-8 h-8 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                <PowerOff className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">Screen-Off Playback</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Phone lock hone ya screen band karne par songs bina ruke smooth chalenge.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">Minimize & Multitask</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  WhatsApp, Instagram ya gaming karte samay background mein nonstop streaming.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-200">Lock Screen Controls</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Notification panel aur lock screen par Play/Pause aur Next Track buttons.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              id="vd-enable-bg-permission-btn"
              type="button"
              onClick={onAllow}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-semibold text-sm shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer floating-btn"
            >
              <Check className="w-4 h-4" />
              <span>Allow Background Playback</span>
            </button>

            <button
              id="vd-dismiss-bg-permission-btn"
              type="button"
              onClick={onDismiss}
              className="w-full py-2.5 px-4 rounded-2xl text-zinc-400 hover:text-zinc-200 text-xs font-medium hover:bg-white/5 transition-all cursor-pointer text-center floating-btn"
            >
              Later / Not Now
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
