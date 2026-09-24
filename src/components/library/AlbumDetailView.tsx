import React, { useMemo } from 'react';
import { ArrowLeft, Play, Shuffle, CheckCircle2, Download, Heart } from 'lucide-react';
import { Track } from '../../types';
import { EnrichedAlbum, extractAlbums } from '../../services/libraryDataService';
import { TrackImage } from '../TrackImage';
import { smartShuffle } from '../../utils/shuffleUtils';
import { TRACKS } from '../../data/musicData';
import { extractPrimaryArtist } from '../../services/musicNormalizationService';

interface AlbumDetailViewProps {
  album: EnrichedAlbum;
  currentTrack: Track | null;
  isPlaying: boolean;
  onBack: () => void;
  onSelectTrack: (track: Track) => void;
  onPlayAlbum: (tracks: Track[], startIndex?: number) => void;
  onToggleFavorite: (trackId: string) => void;
  onToggleDownload: (track: Track) => void;
  isDownloaded: (trackId: string) => boolean;
  onSelectArtistName?: (artistName: string) => void;
  onSelectAlbum?: (album: EnrichedAlbum) => void;
}

export const AlbumDetailView: React.FC<AlbumDetailViewProps> = ({
  album,
  currentTrack,
  isPlaying,
  onBack,
  onSelectTrack,
  onPlayAlbum,
  onToggleFavorite,
  onToggleDownload,
  isDownloaded,
  onSelectArtistName,
  onSelectAlbum
}) => {
  const primaryArtist = extractPrimaryArtist(album.artist);

  const handleShuffle = () => {
    if (album.tracks.length === 0) return;
    const shuffled = smartShuffle(album.tracks);
    onPlayAlbum(shuffled, 0);
  };

  // More albums by the same artist
  const moreByArtist = useMemo(() => {
    const all = extractAlbums(TRACKS);
    return all.filter(
      (a) =>
        a.id !== album.id &&
        extractPrimaryArtist(a.artist).toLowerCase() === primaryArtist.toLowerCase()
    );
  }, [album.id, primaryArtist]);

  // Recommended albums from other artists
  const recommendedAlbums = useMemo(() => {
    const all = extractAlbums(TRACKS);
    return all
      .filter(
        (a) =>
          a.id !== album.id &&
          extractPrimaryArtist(a.artist).toLowerCase() !== primaryArtist.toLowerCase()
      )
      .slice(0, 4);
  }, [album.id, primaryArtist]);

  return (
    <div id="album-detail-view" className="flex flex-col gap-6 animate-fade-in">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <button
          id="back-to-albums-btn"
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] font-bold text-[#a1a1aa] hover:text-[#e4e1e7] transition-colors cursor-pointer py-1"
        >
          <ArrowLeft size={18} />
          Back to Albums
        </button>
      </div>

      {/* Album Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl liquid-glass border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-xl">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-white/10 liquid-glass-heavy">
          <TrackImage
            src={album.coverUrl}
            videoId={album.tracks[0]?.videoId}
            alt={album.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
            Album • {album.year}
          </span>
          <h1 className="text-[22px] sm:text-[26px] font-black text-[#e4e1e7] truncate mt-0.5">
            {album.title}
          </h1>

          {/* Clickable Artist Name */}
          <button
            onClick={() => onSelectArtistName?.(album.artist)}
            className="text-[14px] text-[#a1a1aa] hover:text-[var(--color-primary)] font-medium truncate mt-0.5 text-left cursor-pointer transition-colors"
          >
            {album.artist}
          </button>

          <div className="flex items-center gap-2 mt-2 text-[12px] text-[#a1a1aa]">
            <span>{album.trackCount} {album.trackCount === 1 ? 'song' : 'songs'}</span>
            <span>•</span>
            <span>{album.totalDuration}</span>
          </div>
        </div>

        {/* Play & Smart Shuffle buttons */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          <button
            id="play-album-btn"
            onClick={() => onPlayAlbum(album.tracks, 0)}
            className="px-5 py-2.5 rounded-full bg-[var(--color-primary)] text-[#670211] text-[13px] font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer floating-btn"
          >
            <Play size={18} className="fill-current" />
            Play
          </button>
          <button
            id="shuffle-album-btn"
            onClick={handleShuffle}
            className="w-10 h-10 rounded-full liquid-glass hover:bg-white/20 text-[#e4e1e7] flex items-center justify-center transition-all cursor-pointer active:scale-95 border border-white/10"
            title="Smart Shuffle Album"
          >
            <Shuffle size={18} />
          </button>
        </div>
      </div>

      {/* Tracks List */}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] uppercase font-bold tracking-wider text-[#a1a1aa] px-1">
          Tracklist ({album.tracks.length})
        </span>

        {album.tracks.length === 0 ? (
          <div className="p-8 text-center liquid-glass rounded-2xl text-[#a1a1aa] text-[13px]">
            No tracks found for this album.
          </div>
        ) : (
          album.tracks.map((track, idx) => {
            const isThisActive = currentTrack?.id === track.id;
            const downloaded = isDownloaded(track.id);

            return (
              <div
                key={track.id}
                id={`album-track-${track.id}`}
                onClick={() => onPlayAlbum(album.tracks, idx)}
                className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${
                  isThisActive
                    ? 'liquid-glass/90 border-[var(--color-primary)]/40 ring-1 ring-[var(--color-primary)]/25 shadow-md'
                    : 'liquid-glass hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_8px_20px_0_rgba(0,0,0,0.25)] hover:scale-[1.01] border-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-6 flex items-center justify-center shrink-0">
                    {isThisActive && isPlaying ? (
                      <div className="flex items-end gap-0.5 h-4">
                        <span className="w-1 bg-[var(--color-primary)] rounded-full animate-bounce h-3"></span>
                        <span className="w-1 bg-[var(--color-primary)] rounded-full animate-bounce h-4 delay-75"></span>
                        <span className="w-1 bg-[var(--color-primary)] rounded-full animate-bounce h-2 delay-150"></span>
                      </div>
                    ) : (
                      <span className={`text-[13px] font-mono font-bold ${isThisActive ? 'text-[var(--color-primary)]' : 'text-[#71717a]'}`}>
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 liquid-glass-heavy">
                    <TrackImage
                      src={track.coverUrl}
                      videoId={track.videoId}
                      alt={track.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className={`text-[14px] font-bold truncate ${isThisActive ? 'text-[var(--color-primary)]' : 'text-[#e4e1e7]'}`}>
                      {track.title}
                    </span>
                    <span className="text-[12px] text-[#a1a1aa] truncate mt-0.5">
                      {track.artist}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Favorite button */}
                  <button
                    id={`album-fav-track-${track.id}`}
                    aria-label="Toggle favorite"
                    onClick={() => onToggleFavorite(track.id)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      track.isFavorite ? 'text-[var(--color-primary)]' : 'text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/5'
                    }`}
                  >
                    <Heart size={16} className={track.isFavorite ? 'fill-current' : ''} />
                  </button>

                  <span className="text-[12px] text-[#a1a1aa] font-mono min-w-[36px] text-right">
                    {track.duration}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* More by [Artist] Section */}
      {moreByArtist.length > 0 && (
        <div className="flex flex-col gap-3 pt-4 border-t border-white/10">
          <span className="text-[12px] uppercase font-bold tracking-wider text-[#a1a1aa] px-1">
            More by {album.artist}
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {moreByArtist.map((otherAlb) => (
              <div
                key={otherAlb.id}
                onClick={() => onSelectAlbum?.(otherAlb)}
                className="liquid-glass hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)] hover:scale-105 p-3 rounded-2xl border border-white/[0.04] cursor-pointer group transition-all flex flex-col"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden mb-2.5 liquid-glass-heavy shadow-md">
                  <TrackImage
                    src={otherAlb.coverUrl}
                    videoId={otherAlb.tracks[0]?.videoId}
                    alt={otherAlb.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="font-bold text-[13px] text-[#e4e1e7] truncate group-hover:text-[var(--color-primary)] transition-colors">
                  {otherAlb.title}
                </h3>
                <span className="text-[11px] text-[#a1a1aa] mt-0.5 truncate">
                  {otherAlb.year} • {otherAlb.trackCount} {otherAlb.trackCount === 1 ? 'track' : 'tracks'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Albums */}
      {recommendedAlbums.length > 0 && (
        <div className="flex flex-col gap-3 pt-2">
          <span className="text-[12px] uppercase font-bold tracking-wider text-[#a1a1aa] px-1">
            Recommended Albums
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {recommendedAlbums.map((recAlb) => (
              <div
                key={recAlb.id}
                onClick={() => onSelectAlbum?.(recAlb)}
                className="liquid-glass hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)] hover:scale-105 p-3 rounded-2xl border border-white/[0.04] cursor-pointer group transition-all flex flex-col"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden mb-2.5 liquid-glass-heavy shadow-md">
                  <TrackImage
                    src={recAlb.coverUrl}
                    videoId={recAlb.tracks[0]?.videoId}
                    alt={recAlb.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="font-bold text-[13px] text-[#e4e1e7] truncate group-hover:text-[var(--color-primary)] transition-colors">
                  {recAlb.title}
                </h3>
                <span className="text-[11px] text-[#a1a1aa] mt-0.5 truncate">
                  {recAlb.artist}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
