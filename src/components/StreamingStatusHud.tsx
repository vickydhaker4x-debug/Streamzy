import React, { useState, useEffect } from 'react';
import { Wifi, Zap, Activity, Gauge, ChevronDown, Check, RefreshCw } from 'lucide-react';
import { adaptiveBitrateService } from '../services/adaptiveBitrateService';
import { AbrMetrics } from '../types';

interface StreamingStatusHudProps {
  compact?: boolean;
}

export const StreamingStatusHud: React.FC<StreamingStatusHudProps> = ({ compact = false }) => {
  const [metrics, setMetrics] = useState<AbrMetrics>(() => adaptiveBitrateService.getMetrics());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTestingSpeed, setIsTestingSpeed] = useState(false);

  useEffect(() => {
    const unsub = adaptiveBitrateService.subscribe((newMetrics) => {
      setMetrics(newMetrics);
    });
    return unsub;
  }, []);

  const handleSelectBitrate = (kbps: number | 'auto') => {
    if (kbps === 'auto') {
      adaptiveBitrateService.setAutoAbr(true);
    } else {
      adaptiveBitrateService.setManualBitrate(kbps);
    }
    setIsMenuOpen(false);
  };

  const handleRunSpeedTest = async () => {
    setIsTestingSpeed(true);
    try {
      await adaptiveBitrateService.runSpeedTest();
    } finally {
      setTimeout(() => setIsTestingSpeed(false), 400);
    }
  };

  const formatSpeed = (kbps: number) => {
    if (kbps >= 1000) {
      return `${(kbps / 1000).toFixed(1)} Mbps`;
    }
    return `${kbps} kbps`;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-zinc-400">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/80 border border-white/5 font-mono text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          {metrics.currentBitrateKbps}k
        </span>
        {metrics.isPrebuffered && (
          <span className="inline-flex items-center gap-0.5 text-amber-400 font-medium">
            <Zap className="w-2.5 h-2.5" />
            10s
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Main Glass HUD Container */}
      <div className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900/60 backdrop-blur-md border border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left: Live ABR Quality Selector Pill */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 transition text-zinc-200"
            title="Configure Streaming Protocol & Bitrate"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-[11px] tracking-wide text-zinc-100">
              {metrics.currentBitrateKbps} kbps
            </span>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
              {metrics.tier}
            </span>
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </button>

          {/* Protocol Badge */}
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/60 text-[10px] text-zinc-400 font-mono border border-white/5">
            <Activity className="w-2.5 h-2.5 text-coral-400" />
            {metrics.protocol}
          </span>
        </div>

        {/* Center: Lookahead 10s Pre-buffer Indicator */}
        <div className="flex items-center gap-1.5">
          {metrics.isPrebuffered ? (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]"
              title={`Next track primed: ${metrics.prebufferedTrackTitle || 'Next Track'}`}
            >
              <Zap className="w-3 h-3 text-amber-400 fill-amber-400/30 animate-pulse" />
              <span className="font-medium text-[10px]">10s Pre-buffered</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
              <span>Buffer: {metrics.bufferHealthSec}s</span>
            </div>
          )}
        </div>

        {/* Right: Network & Speed Benchmark */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-300">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span>{formatSpeed(metrics.networkSpeedKbps)}</span>
            <span className="text-[10px] text-zinc-500">({metrics.latencyMs}ms)</span>
          </div>

          <button
            onClick={handleRunSpeedTest}
            disabled={isTestingSpeed}
            className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition active:scale-95 disabled:opacity-50"
            title="Benchmark Connection Speed"
          >
            <RefreshCw className={`w-3 h-3 ${isTestingSpeed ? 'animate-spin text-coral-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bitrate Selector Dropdown Modal */}
      {isMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="absolute left-0 bottom-full mb-2 w-72 rounded-2xl bg-[#1a1a1f] border border-white/10 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-coral-400" />
                  Adaptive Audio Delivery
                </h4>
                <p className="text-[10px] text-zinc-400">Zero-latency ABR streaming engine</p>
              </div>
            </div>

            <div className="p-1 space-y-0.5">
              {/* Auto ABR Option */}
              <button
                onClick={() => handleSelectBitrate('auto')}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-white/5 text-xs transition group"
              >
                <div>
                  <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                    <span>Auto (Dynamic ABR)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-coral-500/20 text-coral-300 font-normal">
                      Recommended
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Matches current internet speed ({formatSpeed(metrics.networkSpeedKbps)})
                  </div>
                </div>
                {metrics.currentBitrateKbps && (
                  <Check className="w-3.5 h-3.5 text-coral-400" />
                )}
              </button>

              {/* Bitrate Tiers */}
              {[
                { kbps: 320, label: '320 kbps Audiophile Lossless', desc: 'Studio grade for fast WiFi / 5G' },
                { kbps: 256, label: '256 kbps High Fidelity', desc: 'Optimal balance of fidelity & bandwidth' },
                { kbps: 128, label: '128 kbps Standard Quality', desc: 'Low data usage, clean sound' },
                { kbps: 64, label: '64 kbps Data Saver', desc: 'Ultra-compressed for weak signals' }
              ].map((tier) => (
                <button
                  key={tier.kbps}
                  onClick={() => handleSelectBitrate(tier.kbps)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-white/5 text-xs transition"
                >
                  <div>
                    <div className="font-medium text-zinc-200">{tier.label}</div>
                    <div className="text-[10px] text-zinc-400">{tier.desc}</div>
                  </div>
                  {metrics.currentBitrateKbps === tier.kbps && (
                    <Check className="w-3.5 h-3.5 text-coral-400" />
                  )}
                </button>
              ))}
            </div>

            <div className="px-3 py-2 border-t border-white/5 bg-white/[0.02] rounded-b-xl flex items-center justify-between text-[10px] text-zinc-400">
              <span>HLS Chunk Size: 5.0s</span>
              <span>Lookahead Pre-buffer: 10s</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
