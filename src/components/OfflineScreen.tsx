import React, { useState, useEffect } from 'react';
import { Track } from '../types';
import { offlineService } from '../services/offlineService';
import { offlineDatabaseService } from '../services/offlineDatabaseService';

interface OfflineScreenProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onTogglePlay?: () => void;
}

export const OfflineScreen: React.FC<OfflineScreenProps> = ({
  currentTrack,
  isPlaying,
  onPlayTrack,
  onTogglePlay
}) => {
  const [downloadedTracks, setDownloadedTracks] = useState<Track[]>([]);
  const [storageUsedMB, setStorageUsedMB] = useState<number>(142.5);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'downloaded' | 'storage'>('downloaded');

  const loadDownloadedTracks = async () => {
    try {
      const records = await offlineDatabaseService.getOfflineTracks();
      if (records && records.length > 0) {
        setDownloadedTracks(records);
        setStorageUsedMB(Number(((records.length * 5.2)).toFixed(1)));
      } else {
        // Sample cached tracks for demo offline availability
        setDownloadedTracks([
          {
            id: 'track-sauda-iss-dil-ka',
            title: 'Sauda Iss Dil Ka (From Sharma Ji Ki Shaadi)',
            artist: 'Shikhar Saxena',
            album: 'Sharma Ji Ki Shaadi',
            duration: '3:27',
            durationSec: 207,
            coverUrl: 'https://i.ytimg.com/vi/Hc-rc1-hcco/mqdefault.jpg',
            videoId: 'Hc-rc1-hcco',
            plays: '1.8 lakh plays',
            isFavorite: true,
            quality: 'Lossless 320kbps (Cached)',
            year: '2024',
            genre: 'Romance',
            isDownloaded: true
          },
          {
            id: 'track-lofi-lovee',
            title: 'Lofi Lovee',
            artist: 'Asees Kaur, Ved Sharma & Harsh Li...',
            album: 'Lofi Lovee',
            duration: '3:15',
            durationSec: 195,
            coverUrl: 'https://i.ytimg.com/vi/vIQAt0eIu2k/mqdefault.jpg',
            videoId: 'vIQAt0eIu2k',
            plays: '12 lakh plays',
            isFavorite: false,
            quality: 'Lossless 320kbps (Cached)',
            year: '2024',
            genre: 'Relax',
            isDownloaded: true
          },
          {
            id: 'track-preet-re',
            title: 'Preet Re - Darshan Raval & Jonita G...',
            artist: 'Darshan Raval, Jonita Gandhi & Roc...',
            album: 'Dhadak 2',
            duration: '3:45',
            durationSec: 225,
            coverUrl: 'https://i.ytimg.com/vi/l8Z3azp_qK8/mqdefault.jpg',
            videoId: 'l8Z3azp_qK8',
            plays: '45 lakh plays',
            isFavorite: true,
            quality: 'Lossless 320kbps (Cached)',
            year: '2024',
            genre: 'Romance',
            isDownloaded: true
          }
        ]);
        setStorageUsedMB(34.8);
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    loadDownloadedTracks();
  }, []);

  const handleClearCache = async () => {
    if (confirm('Clear all downloaded and cached audio tracks?')) {
      try {
        downloadedTracks.forEach((t) => offlineService.removeDownload(t.id));
      } catch {}
      setDownloadedTracks([]);
      setStorageUsedMB(0);
    }
  };

  const filtered = downloadedTracks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0A040C] text-[#DAEAF7] pb-36 pt-20 px-4 sm:px-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#0EA5E0] text-[26px]">download_done</span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Offline & Downloads</h1>
          </div>
          <p className="text-sm text-[#A193A5]">
            Play downloaded tracks anytime without using mobile data or Wi-Fi.
          </p>
        </div>

        {downloadedTracks.length > 0 && (
          <button
            onClick={handleClearCache}
            className="px-3.5 py-2 rounded-xl bg-[#1F1122] hover:bg-[#2D1632] border border-[#3E2145] text-xs font-semibold text-rose-300 flex items-center gap-1.5 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
            Clear Offline Cache
          </button>
        )}
      </div>

      {/* Storage Gauge Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#170E1A] to-[#140C16] border border-[#2D1A2F] mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0EA5E0]/15 text-[#0EA5E0] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">hard_drive</span>
            </div>
            <div>
              <span className="text-xs text-[#A193A5] block">Offline Audio Footprint</span>
              <span className="text-base font-bold text-white">{storageUsedMB} MB Cached</span>
            </div>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#201224] text-[#0EA5E0] border border-[#0EA5E0]/30 font-semibold">
            {downloadedTracks.length} Songs Saved
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-[#221327] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#0EA5E0] to-[#FE385E] rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(8, (storageUsedMB / 500) * 100))}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-[#A193A5] mt-1.5 font-mono">
          <span>High-Bitrate OPUS / AAC</span>
          <span>500 MB Max Recommended</span>
        </div>
      </div>

      {/* Search Filter */}
      {downloadedTracks.length > 0 && (
        <div className="relative mb-5">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A193A5] text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search downloaded songs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#140C16] border border-[#2D1A2F] text-sm text-white placeholder-[#7A6B7E] focus:outline-none focus:border-[#0EA5E0]"
          />
        </div>
      )}

      {/* Track List */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((track) => {
            const isSelected = currentTrack?.id === track.id;
            return (
              <div
                key={track.id}
                onClick={() => {
                  if (isSelected) onTogglePlay();
                  else onPlayTrack(track);
                }}
                className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer group ${
                  isSelected
                    ? 'bg-[#0EA5E0]/15 border-[#0EA5E0]/40 text-white'
                    : 'bg-[#140C16] border-[#241527] hover:bg-[#1C1120] text-[#DAEAF7]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-[#221327]">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#0EA5E0] text-[20px]">
                          {isPlaying ? 'pause' : 'play_arrow'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate text-white">{track.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-[#A193A5] mt-0.5">
                      <span className="truncate">{track.artist}</span>
                      <span>•</span>
                      <span className="text-emerald-400 flex items-center gap-0.5 font-medium text-[11px]">
                        <span className="material-symbols-outlined text-[13px]">offline_pin</span>
                        Ready
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono text-[#A193A5]">{track.duration}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isSelected) onTogglePlay();
                      else onPlayTrack(track);
                    }}
                    className="w-8 h-8 rounded-full bg-[#1F1223] hover:bg-[#0EA5E0] hover:text-black text-[#0EA5E0] flex items-center justify-center transition"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isSelected && isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center text-[#A193A5]">
          <span className="material-symbols-outlined text-5xl text-[#3E2544] mb-2 block">cloud_off</span>
          <p className="text-base font-semibold text-white">No offline songs available</p>
          <p className="text-xs mt-1 text-[#7A6B7E] max-w-sm mx-auto">
            Tap the download icon on any song or playlist in Explore or Search to save tracks for instant offline listening.
          </p>
        </div>
      )}
    </div>
  );
};
