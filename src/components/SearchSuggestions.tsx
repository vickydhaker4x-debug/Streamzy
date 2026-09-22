import React, { useEffect, useState, useMemo } from 'react';
import { History, ArrowUpLeft, X, Music, Play, Search, User, Disc3 } from 'lucide-react';
import { Track, Artist, Album, Playlist, MusicMix } from '../types';
import { fetchSearchSuggestions } from '../utils/pipedApi';
import { searchEngine, SearchSuggestionItem } from '../services/searchEngine';

interface SearchSuggestionsProps {
  query: string;
  onSelectSong?: (track: Track) => void;
  onSelectArtist?: (artist: Artist) => void;
  onSelectAlbum?: (album: Album) => void;
  onSelectPlaylist?: (playlist: Playlist | MusicMix) => void;
  onSelectQuery: (query: string) => void;
  onInsertQuery: (query: string) => void;
  recentSearches: string[];
  onRemoveRecentSearch: (item: string) => void;
  onClearRecentSearches: () => void;
  isVisible: boolean;
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  query,
  onSelectSong,
  onSelectArtist,
  onSelectAlbum,
  onSelectPlaylist,
  onSelectQuery,
  onInsertQuery,
  recentSearches,
  onRemoveRecentSearch,
  onClearRecentSearches,
  isVisible
}) => {
  const [onlineSuggestions, setOnlineSuggestions] = useState<string[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState<boolean>(false);

  const trimmedQuery = query.trim().toLowerCase();

  // 1. Generate rich structured suggestions from searchEngine
  const richSuggestions = useMemo(() => {
    if (!trimmedQuery) return [];
    return searchEngine.getSuggestions(query);
  }, [trimmedQuery, query]);

  // 2. Fetch online autocomplete queries (allow single word / character)
  useEffect(() => {
    if (!trimmedQuery) {
      setOnlineSuggestions([]);
      return;
    }

    let isMounted = true;
    const fetchSuggestions = async () => {
      setIsFetchingSuggestions(true);
      try {
        const results = await fetchSearchSuggestions(trimmedQuery);
        if (isMounted) {
          setOnlineSuggestions(results.slice(0, 5));
        }
      } catch (err) {
        // Silent catch
      } finally {
        if (isMounted) setIsFetchingSuggestions(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  if (!isVisible) return null;

  const highlightMatch = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <span key={i} className="text-white font-bold">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  const handleItemClick = (item: SearchSuggestionItem) => {
    if (item.type === 'song' && item.track && onSelectSong) {
      onSelectSong(item.track);
    } else if (item.type === 'artist' && item.artist && onSelectArtist) {
      onSelectArtist(item.artist);
    } else if (item.type === 'album' && item.album && onSelectAlbum) {
      onSelectAlbum(item.album);
    } else if (item.type === 'playlist' && item.playlist && onSelectPlaylist) {
      onSelectPlaylist(item.playlist);
    } else {
      onSelectQuery(item.targetQuery || item.title);
    }
  };

  // If query is empty, show recent searches
  if (!query.trim()) {
    if (recentSearches.length === 0) return null;

    return (
      <div className="w-full liquid-glass/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-3 shadow-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150 z-20">
        <div className="flex items-center justify-between px-2 pb-1 border-b border-white/[0.04]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-1.5">
            <History size={14} />
            Recent Searches
          </span>
          <button
            onClick={onClearRecentSearches}
            className="text-[11px] text-[#71717a] hover:text-[#e4e1e7] transition-colors cursor-pointer floating-btn"
          >
            Clear all
          </button>
        </div>

        <div className="flex flex-col gap-0.5">
          {recentSearches.slice(0, 6).map((item) => (
            <div
              key={item}
              className="flex items-center justify-between px-2.5 py-2 hover:bg-white/[0.1] hover:shadow-lg hover:scale-[1.01] transition-all duration-300 rounded-xl group cursor-pointer"
              onClick={() => onSelectQuery(item)}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <History size={16} className="text-[#71717a] group-hover:text-[var(--color-primary)] transition-colors" />
                <span className="text-[13px] text-[#e4e1e7] truncate group-hover:text-white">
                  {item}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onInsertQuery(item);
                  }}
                  title="Insert into search"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/[0.06] cursor-pointer"
                >
                  <ArrowUpLeft size={15} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRecentSearch(item);
                  }}
                  title="Remove from history"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#71717a] hover:text-rose-400 hover:bg-white/[0.06] cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Partition rich suggestions into Songs, Artists/Albums, and Queries
  const songSuggestions = richSuggestions.filter((s) => s.type === 'song');
  const artistAlbumSuggestions = richSuggestions.filter((s) => s.type === 'artist' || s.type === 'album');
  const seenQueryTitles = new Set(richSuggestions.map((s) => s.title.toLowerCase()));
  const extraOnlineQueries = onlineSuggestions.filter((q) => !seenQueryTitles.has(q.toLowerCase()));
  const querySuggestions = [
    ...richSuggestions.filter((s) => s.type === 'query'),
    ...extraOnlineQueries.map((q) => ({
      id: `sug-onl-${q}`,
      type: 'query' as const,
      title: q,
      subtitle: 'Related query',
      targetQuery: q
    }))
  ];

  if (
    songSuggestions.length === 0 &&
    artistAlbumSuggestions.length === 0 &&
    querySuggestions.length === 0 &&
    !isFetchingSuggestions
  ) {
    return null;
  }

  return (
    <div
      id="search-live-suggestions"
      className="w-full liquid-glass/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-3 shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-150 z-20 max-h-[70vh] overflow-y-auto"
    >
      {/* 1. Related Songs Section */}
      {songSuggestions.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-2 pb-1 border-b border-white/[0.06]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <Music size={14} />
              Songs related to &ldquo;{query}&rdquo;
            </span>
            <span className="text-[10px] text-zinc-400">
              {songSuggestions.length} found
            </span>
          </div>

          <div className="flex flex-col gap-1 mt-1">
            {songSuggestions.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="flex items-center justify-between px-2.5 py-2 hover:bg-white/[0.1] hover:shadow-lg hover:scale-[1.01] transition-all duration-200 rounded-xl group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-9 h-9 shrink-0 rounded-lg overflow-hidden border border-white/10 bg-zinc-800">
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400">
                        <Music size={18} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Play size={18} className="text-white fill-current" />
                    </div>
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-semibold text-white truncate group-hover:text-rose-300 transition-colors">
                      {highlightMatch(item.title, trimmedQuery)}
                    </span>
                    {item.subtitle && (
                      <span className="text-[11px] text-zinc-400 truncate">
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                    Play
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onInsertQuery(item.targetQuery || item.title);
                    }}
                    title="Insert into search"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <ArrowUpLeft size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Related Search Terms */}
      {querySuggestions.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-2 pb-1 border-b border-white/[0.06]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Search size={14} />
              Related Searches
            </span>
          </div>

          <div className="flex flex-col gap-0.5 mt-1">
            {querySuggestions.slice(0, 5).map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectQuery(item.targetQuery || item.title)}
                className="flex items-center justify-between px-2.5 py-1.5 hover:bg-white/[0.1] rounded-xl group cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Search size={16} className="text-zinc-500 group-hover:text-rose-400 transition-colors" />
                  <span className="text-[13px] text-zinc-200 truncate group-hover:text-white">
                    {highlightMatch(item.title, trimmedQuery)}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onInsertQuery(item.targetQuery || item.title);
                  }}
                  title="Insert into search"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                >
                  <ArrowUpLeft size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Artists & Albums Section */}
      {artistAlbumSuggestions.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-2 pb-1 border-b border-white/[0.06]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <User size={14} />
              Artists &amp; Albums
            </span>
          </div>

          <div className="flex flex-col gap-1 mt-1">
            {artistAlbumSuggestions.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="flex items-center justify-between px-2.5 py-2 hover:bg-white/[0.1] rounded-xl group cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.coverUrl ? (
                    <img
                      src={item.coverUrl}
                      alt={item.title}
                      className={`w-8 h-8 object-cover shrink-0 border border-white/10 ${
                        item.type === 'artist' ? 'rounded-full' : 'rounded-lg'
                      }`}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/10 text-zinc-400">
                      {item.type === 'artist' ? <User size={16} /> : <Disc3 size={16} />}
                    </div>
                  )}

                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-medium text-white truncate group-hover:text-rose-300">
                      {highlightMatch(item.title, trimmedQuery)}
                    </span>
                    {item.subtitle && (
                      <span className="text-[11px] text-zinc-400 truncate">
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 uppercase tracking-wider">
                  {item.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
