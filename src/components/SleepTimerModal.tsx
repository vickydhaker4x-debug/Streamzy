import React, { useState, useEffect } from 'react';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetTimer: (minutes: number) => void;
  onCancelTimer: () => void;
  remainingMinutes: number | null;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({
  isOpen,
  onClose,
  onSetTimer,
  onCancelTimer,
  remainingMinutes
}) => {
  const [customMin, setCustomMin] = useState<string>('20');
  const [finishCurrentSong, setFinishCurrentSong] = useState(true);

  if (!isOpen) return null;

  const quickOptions = [15, 30, 45, 60, 90];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#140C16] border border-[#2D1A2F] rounded-3xl p-6 relative text-[#DAEAF7]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#FE385E]/20 text-[#FE385E] flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">bedtime</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Sleep Timer</h2>
            <p className="text-xs text-[#A193A5]">Audio will smoothly fade out and stop</p>
          </div>
        </div>

        {/* Active status */}
        {remainingMinutes !== null && remainingMinutes > 0 ? (
          <div className="p-4 rounded-2xl bg-[#201024] border border-[#FE385E]/30 mb-5 text-center">
            <span className="text-xs text-[#FE385E] uppercase font-bold tracking-wider block mb-1">Timer Active</span>
            <div className="text-3xl font-mono font-bold text-white">{remainingMinutes} mins</div>
            <p className="text-xs text-[#A193A5] mt-1">Music will pause automatically</p>

            <button
              onClick={() => {
                onCancelTimer();
                onClose();
              }}
              className="mt-3 px-4 py-2 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-semibold transition"
            >
              Turn Off Timer
            </button>
          </div>
        ) : null}

        {/* Preset Options */}
        <div className="space-y-2 mb-5">
          <span className="text-xs text-[#A193A5] font-semibold uppercase tracking-wider block">Quick Presets</span>
          <div className="grid grid-cols-3 gap-2">
            {quickOptions.map((mins) => (
              <button
                key={mins}
                onClick={() => {
                  onSetTimer(mins);
                  onClose();
                }}
                className="py-2.5 rounded-xl bg-[#1C1020] hover:bg-[#FE385E] hover:text-white border border-[#2D1B31] text-xs font-bold transition text-white text-center"
              >
                {mins} min
              </button>
            ))}
            <button
              onClick={() => {
                onSetTimer(5); // End of current song approximation
                onClose();
              }}
              className="py-2.5 rounded-xl bg-[#1C1020] hover:bg-[#0EA5E0] hover:text-black border border-[#2D1B31] text-xs font-bold transition text-[#0EA5E0] text-center"
            >
              End of Song
            </button>
          </div>
        </div>

        {/* Custom Input */}
        <div className="p-3 rounded-2xl bg-[#1C1020] border border-[#2D1B31] flex items-center justify-between gap-3 mb-5">
          <span className="text-xs font-semibold text-white">Custom Minutes:</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="300"
              value={customMin}
              onChange={(e) => setCustomMin(e.target.value)}
              className="w-16 px-2 py-1 rounded-lg bg-[#140C16] border border-[#301B34] text-center text-white text-xs font-mono font-bold focus:outline-none focus:border-[#FE385E]"
            />
            <button
              onClick={() => {
                const val = parseInt(customMin, 10);
                if (val > 0) {
                  onSetTimer(val);
                  onClose();
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-[#FE385E] text-white text-xs font-bold hover:bg-[#ff4e71] transition"
            >
              Set
            </button>
          </div>
        </div>

        {/* Toggle Finish current song */}
        <label className="flex items-center justify-between cursor-pointer text-xs text-[#A193A5]">
          <span>Wait for song to finish before fading</span>
          <input
            type="checkbox"
            checked={finishCurrentSong}
            onChange={(e) => setFinishCurrentSong(e.target.checked)}
            className="accent-[#FE385E] w-4 h-4 rounded cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
};
