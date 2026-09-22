import React, { useState, useEffect, useMemo } from 'react';
import { BellOff, Sparkles, Volume2, CheckCircle2, Download, Heart, Check, Plus } from 'lucide-react';
import { Track } from '../../types';
import { EnrichedArtist } from '../../services/libraryDataService';
import { subscriptionService } from '../../services/subscriptionService';
import { TrackImage } from '../TrackImage';

interface SubscriptionsSectionProps {
  artists: EnrichedArtist[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelectArtist: (artist: EnrichedArtist) => void;
  onSelectTrack: (track: Track) => void;
  onToggleFavorite: (trackId: string) => void;
  onToggleDownload: (track: Track) => void;
  isDownloaded: (trackId: string) => boolean;
}

export const SubscriptionsSection: React.FC<SubscriptionsSectionProps> = ({
  artists,
  currentTrack,
  isPlaying,
  onSelectArtist,
  onSelectTrack,
  onToggleFavorite,
  onToggleDownload,
  isDownloaded
}) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscriptionService.subscribeListener(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  // Find artists matching subscribed names
  const followedArtists = artists.filter((a) => subscriptionService.isSubscribed(a.name));
  const suggestedArtists = artists.filter((a) => !subscriptionService.isSubscribed(a.name)).slice(0, 6);

  // Tracks from subscribed artists deduped by ID
  const uniqueSubTracks: Track[] = useMemo(() => {
    const map = new Map<string, Track>();
    followedArtists.forEach((a) => {
      a.tracks.forEach((t) => {
        if (!map.has(t.id)) {
          map.set(t.id, t);
        }
      });
    });
    return Array.from(map.values());
  }, [followedArtists]);

  const handleToggle = (artistName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    subscriptionService.toggleSubscription(artistName);
  };

  return (
    <div id="subscriptions-section" className="flex flex-col gap-6 animate-fade-in">
      {/* Subscribed Artists Horizontal Carousel / Avatar Row */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] uppercase font-bold tracking-wider text-[#a1a1aa]">
            Subscribed Artists ({followedArtists.length})
          </span>
        </div>

        {followedArtists.length === 0 ? (
          <div className="p-8 text-center liquid-glass rounded-3xl border border-white/[0.04]">
            <div className="w-14 h-14 rounded-2xl liquid-glass text-[#a1a1aa] flex items-center justify-center mx-auto mb-3">
              <BellOff size={28} />
            </div>
            <h3 className="text-[16px] font-bold text-[#e4e1e7]">No Subscriptions Yet</h3>
            <p className="text-[12px] text-[#a1a1aa] max-w-sm mx-auto mt-1">
              Subscribe to artists below to get quick access to their music and updates.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2 px-1">
            {followedArtists.map((artist) => (
              <div
                key={artist.id}
                id={`sub-artist-avatar-${artist.name}`}
                onClick={() => onSelectArtist(artist)}
                className="flex flex-col items-center gap-2 cursor-pointer shrink-0 group"
              >
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full overflow-hidden liquid-glass-heavy ring-2 ring-white/10 group-hover:ring-[var(--color-primary)] transition-all shadow-md">
                  <TrackImage
                    src={artist.avatarUrl}
                    videoId={artist.tracks[0]?.videoId}
                    alt={artist.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <span className="text-[12px] font-bold text-[#e4e1e7] group-hover:text-[var(--color-primary)] transition-colors text-center w-20 truncate">
                  {artist.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Latest Songs from Subscribed Artists */}
      {uniqueSubTracks.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[var(--color-primary)]" />
              <span className="text-[12px] uppercase font-bold tracking-wider text-[#a1a1aa]">
                Tracks from Your Subscriptions
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {uniqueSubTracks.slice(0, 10).map((track) => {
              const isThisActive = currentTrack?.id === track.id;
              const downloaded = isDownloaded(track.id);

              return (
                <div
                  key={track.id}
                  onClick={() => onSelectTrack(track)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer border transition-all ${
                    isThisActive
                      ? 'liquid-glass/90 border-[var(--color-primary)]/40 ring-1 ring-[var(--color-primary)]/25 shadow-md'
                      : 'liquid-glass hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_8px_20px_0_rgba(0,0,0,0.25)] hover:scale-[1.01] border-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 liquid-glass-heavy relative">
                      <TrackImage
                        src={track.coverUrl}
                        videoId={track.videoId}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                      {isThisActive && isPlaying && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Volume2 size={18} className="text-[var(--color-primary)] animate-pulse" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className={`text-[14px] font-bold truncate ${isThisActive ? 'text-[var(--color-primary)]' : 'text-[#e4e1e7]'}`}>
                        {track.title}
                      </span>
                      <span className="text-[12px] text-[#a1a1aa] truncate mt-0.5">
                        {track.artist} • {track.album}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      aria-label="Toggle download"
                      onClick={() => onToggleDownload(track)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        downloaded ? 'text-emerald-400 bg-emerald-500/10' : 'text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/5'
                      }`}
                    >
                      {downloaded ? <CheckCircle2 size={18} /> : <Download size={18} />}
                    </button>

                    <button
                      aria-label="Toggle favorite"
                      onClick={() => onToggleFavorite(track.id)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        track.isFavorite ? 'text-[var(--color-primary)]' : 'text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/5'
                      }`}
                    >
                      <Heart
                        size={18}
                        className={track.isFavorite ? 'fill-current' : ''}
                      />
                    </button>

                    <span className="text-[12px] text-[#a1a1aa] font-mono min-w-[36px] text-right">
                      {track.duration}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggested Artists to Follow */}
      {suggestedArtists.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-[12px] uppercase font-bold tracking-wider text-[#a1a1aa] px-1">
            Suggested Artists to Follow
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {suggestedArtists.map((artist) => {
              const isSub = subscriptionService.isSubscribed(artist.name);

              return (
                <div
                  key={artist.id}
                  onClick={() => onSelectArtist(artist)}
                  className="p-3.5 rounded-2xl liquid-glass border border-white/[0.04] hover:bg-white/[0.08] cursor-pointer flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 liquid-glass-heavy">
                      <TrackImage
                        src={artist.avatarUrl}
                        videoId={artist.tracks[0]?.videoId}
                        alt={artist.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[14px] font-bold text-[#e4e1e7] truncate">{artist.name}</span>
                      <span className="text-[12px] text-[#a1a1aa] truncate">{artist.subscribers || 'Artist'}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleToggle(artist.name, e)}
                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 shadow-sm active:scale-95 ${
                      isSub
                        ? 'bg-white/10 text-[#e4e1e7] border border-white/20'
                        : 'bg-[var(--color-primary)] text-[#670211]'
                    }`}
                  >
                    {isSub ? <Check size={14} /> : <Plus size={14} />}
                    {isSub ? 'Following' : 'Subscribe'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
