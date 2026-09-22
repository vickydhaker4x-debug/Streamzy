import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, X, ArrowLeftRight, Activity } from 'lucide-react';
import { EQUALIZER_PRESETS } from '../data/bloomeePlugins';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPreset?: string;
  onPresetChange?: (preset: string, bands: number[]) => void;
  crossfadeSec?: number;
  onCrossfadeChange?: (sec: number) => void;
}

const BAND_FREQUENCIES = ['31Hz', '62Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];

export const EqualizerModal: React.FC<EqualizerModalProps> = ({
  isOpen,
  onClose,
  currentPreset = 'Normal',
  onPresetChange,
  crossfadeSec = 3,
  onCrossfadeChange
}) => {
  const [activePreset, setActivePreset] = useState<string>(currentPreset);
  const [bands, setBands] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('bloomee_eq_bands');
      if (saved) return JSON.parse(saved);
    } catch {}
    return EQUALIZER_PRESETS[currentPreset] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  });
  const [crossfade, setCrossfade] = useState<number>(crossfadeSec);
  const [bassBoost, setBassBoost] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('bloomee_bass_boost')) || 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    if (EQUALIZER_PRESETS[activePreset]) {
      setBands(EQUALIZER_PRESETS[activePreset]);
    }
  }, [activePreset]);

  const handleBandChange = (index: number, val: number) => {
    const updated = [...bands];
    updated[index] = val;
    setBands(updated);
    setActivePreset('Custom');
    try {
      localStorage.setItem('bloomee_eq_bands', JSON.stringify(updated));
    } catch {}
    if (onPresetChange) onPresetChange('Custom', updated);
  };

  const handleSelectPreset = (presetName: string) => {
    setActivePreset(presetName);
    const newBands = EQUALIZER_PRESETS[presetName] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    setBands(newBands);
    try {
      localStorage.setItem('bloomee_eq_bands', JSON.stringify(newBands));
    } catch {}
    if (onPresetChange) onPresetChange(presetName, newBands);
  };

  const handleCrossfadeChange = (val: number) => {
    setCrossfade(val);
    try {
      localStorage.setItem('bloomee_crossfade', String(val));
    } catch {}
    if (onCrossfadeChange) onCrossfadeChange(val);
  };

  const handleReset = () => {
    handleSelectPreset('Normal');
    setBassBoost(0);
    setCrossfade(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-2xl bg-[#0F0811] border border-[#2E1A31] rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 max-h-[92vh] overflow-y-auto relative text-[#DAEAF7]">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#FE385E]/20 text-[#FE385E] flex items-center justify-center">
              <SlidersHorizontal size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Streamzy Equalizer
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#FE385E]/20 text-[#FE385E]">
                  10-BAND DSP
                </span>
              </h2>
              <p className="text-xs text-[#A193A5]">Acoustic soundstage fine-tuning & crossfade curve</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#A193A5] hover:text-white transition"
            >
              Reset
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preset Chips */}
        <div className="mb-6">
          <span className="text-xs text-[#A193A5] font-semibold uppercase tracking-wider block mb-2">Sound Presets</span>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {Object.keys(EQUALIZER_PRESETS).map((preset) => {
              const isActive = activePreset === preset;
              return (
                <button
                  key={preset}
                  onClick={() => handleSelectPreset(preset)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer ${
                    isActive
                      ? 'bg-[#FE385E] text-white shadow-[0_0_15px_rgba(254,56,94,0.4)]'
                      : 'bg-[#1A101C] text-[#A193A5] hover:bg-[#251728] hover:text-white border border-[#2D1B31]'
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>

        {/* 10-Band Sliders Graphic */}
        <div className="p-4 rounded-2xl bg-[#140C16] border border-[#2A162D] mb-6">
          <div className="flex justify-between text-[11px] text-[#A193A5] font-mono mb-2">
            <span>+12 dB</span>
            <span className="text-[#0EA5E0]">0 dB (Flat)</span>
            <span>-12 dB</span>
          </div>

          <div className="grid grid-cols-10 gap-1.5 sm:gap-2 h-48 items-center pt-2">
            {bands.map((gain, index) => {
              return (
                <div key={BAND_FREQUENCIES[index]} className="flex flex-col items-center justify-between h-full group">
                  <span className="text-[10px] font-mono text-[#FE385E] font-bold">{gain > 0 ? `+${gain}` : gain}</span>

                  {/* Vertical Slider Track */}
                  <div className="relative flex items-center justify-center h-32 w-5 sm:w-6">
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={gain}
                      onChange={(e) => handleBandChange(index, Number(e.target.value))}
                      className="accent-[#FE385E] h-28 -rotate-90 cursor-pointer w-28"
                    />
                  </div>

                  <span className="text-[9px] sm:text-[10px] font-mono text-[#A193A5] group-hover:text-white">
                    {BAND_FREQUENCIES[index]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Crossfade & Bass Boost Enhancers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Crossfade Slider */}
          <div className="p-4 rounded-2xl bg-[#140C16] border border-[#2A162D]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <ArrowLeftRight size={16} className="text-[#0EA5E0]" />
                Crossfade Tracks
              </span>
              <span className="text-xs font-mono text-[#0EA5E0] font-bold">{crossfade}s</span>
            </div>
            <p className="text-[11px] text-[#A193A5] mb-2">Smooth transition fade between consecutive songs</p>
            <input
              type="range"
              min="0"
              max="12"
              step="1"
              value={crossfade}
              onChange={(e) => handleCrossfadeChange(Number(e.target.value))}
              className="w-full accent-[#0EA5E0] cursor-pointer"
            />
          </div>

          {/* Bass Boost Slider */}
          <div className="p-4 rounded-2xl bg-[#140C16] border border-[#2A162D]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Activity size={16} className="text-[#FE385E]" />
                Dynamic Sub-Bass
              </span>
              <span className="text-xs font-mono text-[#FE385E] font-bold">+{bassBoost * 2} dB</span>
            </div>
            <p className="text-[11px] text-[#A193A5] mb-2">Low-end punch amplification without distortion</p>
            <input
              type="range"
              min="0"
              max="5"
              step="1"
              value={bassBoost}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBassBoost(val);
                try {
                  localStorage.setItem('bloomee_bass_boost', String(val));
                } catch {}
              }}
              className="w-full accent-[#FE385E] cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
