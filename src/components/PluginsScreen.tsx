import React, { useState } from 'react';
import { BloomeePlugin } from '../types';
import { BLOOMEE_PLUGINS } from '../data/bloomeePlugins';

interface PluginsScreenProps {
  onBack?: () => void;
}

export const PluginsScreen: React.FC<PluginsScreenProps> = ({ onBack }) => {
  const [plugins, setPlugins] = useState<BloomeePlugin[]>(() => {
    try {
      const saved = localStorage.getItem('bloomee_plugins');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return BLOOMEE_PLUGINS;
  });
  const [selectedPlugin, setSelectedPlugin] = useState<BloomeePlugin | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPluginUrl, setNewPluginUrl] = useState('');
  const [testLog, setTestLog] = useState<string | null>(null);

  const handleToggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlugins((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, isEnabled: !p.isEnabled } : p));
      try {
        localStorage.setItem('bloomee_plugins', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleInstallPlugin = () => {
    if (!newPluginUrl.trim()) return;
    const nameFromUrl = newPluginUrl.split('/').pop()?.replace('.bex', '') || 'Custom Plugin';
    const newPlugin: BloomeePlugin = {
      id: `plugin-custom-${Date.now()}`,
      name: nameFromUrl.charAt(0).toUpperCase() + nameFromUrl.slice(1),
      version: '1.0.0',
      author: 'Community Contributor',
      description: `Custom stream extension loaded from ${newPluginUrl}`,
      icon: 'extension',
      type: 'audio_streamer',
      isEnabled: true,
      priority: plugins.length + 1,
      capabilities: ['External Stream Resolver', 'Custom Pipeline'],
      isOfficial: false,
      sourceUrl: newPluginUrl
    };

    const updated = [...plugins, newPlugin];
    setPlugins(updated);
    try {
      localStorage.setItem('bloomee_plugins', JSON.stringify(updated));
    } catch {}
    setNewPluginUrl('');
    setShowAddModal(false);
    setTestLog(`Installed "${newPlugin.name}" successfully! Active in stream pipeline.`);
    setTimeout(() => setTestLog(null), 4000);
  };

  const handleMovePriority = (index: number, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === plugins.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...plugins];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    // Update priorities
    const updated = reordered.map((p, idx) => ({ ...p, priority: idx + 1 }));
    setPlugins(updated);
    try {
      localStorage.setItem('bloomee_plugins', JSON.stringify(updated));
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#0A040C] text-[#DAEAF7] pb-36 pt-20 px-4 sm:px-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#FE385E] text-[26px]">extension</span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Streamzy Plugins</h1>
            <span className="px-2 py-0.5 rounded-full bg-[#FE385E]/20 text-[#FE385E] text-xs font-mono font-semibold">
              .BEX Engine
            </span>
          </div>
          <p className="text-sm text-[#A193A5]">
            Modular stream resolvers and metadata plugins powering Streamzy's ad-free music playback.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-full bg-[#FE385E] hover:bg-[#ff4e71] text-white font-semibold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(254,56,94,0.35)] active:scale-95 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Install .BEX Plugin
        </button>
      </div>

      {testLog && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{testLog}</span>
        </div>
      )}

      {/* Info Card */}
      <div className="p-4 rounded-2xl bg-[#140C16] border border-[#2D1A2F] mb-6 flex items-start gap-3">
        <span className="material-symbols-outlined text-[#0EA5E0] text-[22px] shrink-0 mt-0.5">hub</span>
        <div className="text-xs text-[#A193A5] leading-relaxed">
          <span className="font-semibold text-white">Priority-Based Resolution:</span> When a song is requested,
          Streamzy queries plugins in the order shown below. If YouTube Music fails or encounters rate limits, it
          instantly cascades to Piped, JioSaavn, or Invidious with zero audible interruption.
        </div>
      </div>

      {/* Plugin List */}
      <div className="space-y-3">
        {plugins.map((plugin, index) => {
          return (
            <div
              key={plugin.id}
              onClick={() => setSelectedPlugin(plugin)}
              className={`p-4 rounded-2xl border transition cursor-pointer group ${
                plugin.isEnabled
                  ? 'bg-[#140C16] border-[#2E1A31] hover:border-[#FE385E]/50'
                  : 'bg-[#100812]/50 border-[#1F1221] opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      plugin.isEnabled
                        ? 'bg-[#221327] text-[#FE385E] group-hover:scale-105 transition'
                        : 'bg-[#1A0F1E] text-zinc-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[24px]">{plugin.icon}</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-white truncate">{plugin.name}</h3>
                      <span className="text-[11px] font-mono text-[#0EA5E0] bg-[#0EA5E0]/15 px-2 py-0.5 rounded-md">
                        v{plugin.version}
                      </span>
                      {plugin.isOfficial && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-600/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">verified</span>
                          Official
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#A193A5] mt-1 line-clamp-2">{plugin.description}</p>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] text-[#A193A5] font-semibold">Priority #{plugin.priority}</span>
                      <span>•</span>
                      {plugin.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-[#201224] text-[#DAEAF7] border border-[#301B34]"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right controls: Move Up/Down + Enable Toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col gap-1">
                    <button
                      disabled={index === 0}
                      onClick={(e) => handleMovePriority(index, 'up', e)}
                      className="p-1 rounded hover:bg-white/10 text-[#A193A5] disabled:opacity-20 hover:text-white transition"
                      title="Move Priority Up"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                    </button>
                    <button
                      disabled={index === plugins.length - 1}
                      onClick={(e) => handleMovePriority(index, 'down', e)}
                      className="p-1 rounded hover:bg-white/10 text-[#A193A5] disabled:opacity-20 hover:text-white transition"
                      title="Move Priority Down"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                    </button>
                  </div>

                  <button
                    onClick={(e) => handleToggle(plugin.id, e)}
                    className={`relative w-12 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                      plugin.isEnabled ? 'bg-[#FE385E]' : 'bg-[#2A162D]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        plugin.isEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Plugin Modal */}
      {selectedPlugin && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#140C16] border border-[#2D1A2F] rounded-3xl p-6 relative">
            <button
              onClick={() => setSelectedPlugin(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#221327] text-[#FE385E] flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">{selectedPlugin.icon}</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{selectedPlugin.name}</h2>
                <span className="text-xs text-[#0EA5E0] font-mono">
                  v{selectedPlugin.version} • by {selectedPlugin.author}
                </span>
              </div>
            </div>

            <p className="text-sm text-[#A193A5] mb-5 leading-relaxed">{selectedPlugin.description}</p>

            <div className="space-y-2 mb-6">
              <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Features</div>
              <div className="flex flex-wrap gap-2">
                {selectedPlugin.capabilities.map((c) => (
                  <span
                    key={c}
                    className="px-2.5 py-1 rounded-lg bg-[#201224] text-xs text-[#DAEAF7] border border-[#301B34]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#2D1A2F]">
              <span className="text-xs text-[#A193A5]">Plugin Active</span>
              <button
                onClick={(e) => {
                  handleToggle(selectedPlugin.id, e);
                  setSelectedPlugin((prev) => (prev ? { ...prev, isEnabled: !prev.isEnabled } : null));
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  selectedPlugin.isEnabled
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {selectedPlugin.isEnabled ? 'Disable Plugin' : 'Enable Plugin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Plugin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#140C16] border border-[#2D1A2F] rounded-3xl p-6 relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FE385E]">extension</span>
              Install Streamzy .BEX
            </h2>
            <p className="text-xs text-[#A193A5] mb-4">
              Enter the URL of a Streamzy-compatible plugin repository or direct `.bex` manifest URL.
            </p>

            <input
              type="text"
              placeholder="https://raw.githubusercontent.com/.../plugin.bex"
              value={newPluginUrl}
              onChange={(e) => setNewPluginUrl(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#1D1020] border border-[#301B34] text-white text-sm focus:outline-none focus:border-[#FE385E] mb-4 font-mono"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleInstallPlugin}
                className="flex-1 py-2.5 rounded-xl bg-[#FE385E] hover:bg-[#ff4e71] text-white text-xs font-bold transition shadow-[0_0_15px_rgba(254,56,94,0.35)]"
              >
                Install Plugin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
