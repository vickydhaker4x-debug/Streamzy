import React, { useEffect, useState, useMemo } from 'react';
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

  // 2. Fetch online autocomplete queries
  useEffect(() => {
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setOnlineSuggestions([]);
      return;
    }

    let isMounted = true;
    const fetchSuggestions = async () => {
      setIsFetchingSuggestions(true);
      try {
        const results = await fetchSearchSuggestions(trimmedQuery);
        if (isMounted) {
          setOnlineSuggestions(results.slice(0, 4));
        }
      } catch (err) {
        // Silent catch
      } finally {
        if (isMounted) setIsFetchingSuggestions(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
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
            <span className="material-symbols-outlined floating-icon text-[15px]">history</span>
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
                <span className="material-symbols-outlined floating-icon text-[#71717a] group-hover:text-[var(--color-primary)] text-[18px]">
                  history
                </span>
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
                  <span className="material-symbols-outlined floating-icon text-[16px]">north_west</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRecentSearch(item);
                  }}
                  title="Remove from history"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#71717a] hover:text-rose-400 hover:bg-white/[0.06] cursor-pointer"
                >
                  <span className="material-symbols-outlined floating-icon text-[16px]">close</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const seenQueryTitles = new Set(richSuggestions.map((s) => s.title.toLowerCase()));
  const extraOnlineQueries = onlineSuggestions.filter((q) => !seenQueryTitles.has(q.toLowerCase()));

  if (richSuggestions.length === 0 && extraOnlineQueries.length === 0 && !isFetchingSuggestions) {
    return null;
  }

  return (
    <div
      id="search-live-suggestions"
      className="w-full liquid-glass/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-3 shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-150 z-20"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-2 pb-1 border-b border-white/[0.04]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-1.5">
            <span className="material-symbols-outlined floating-icon text-[15px]">search</span>
            Search Suggestions
          </span>
        </div>

        <div className="flex flex-col gap-1 mt-1">
          {richSuggestions.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="flex items-center justify-between px-2.5 py-2 hover:bg-white/[0.1] hover:shadow-lg hover:scale-[1.01] transition-all duration-200 rounded-xl group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    className={`w-9 h-9 object-cover shrink-0 border border-white/10 ${
                      item.type === 'artist' ? 'rounded-full' : 'rounded-lg'
                    }`}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 border border-white/10 text-zinc-400">
                    <span className="material-symbols-outlined floating-icon text-[18px]">
                      {item.type === 'artist'
                        ? 'person'
                        : item.type === 'album'
                        ? 'album'
                        : item.type === 'playlist'
                        ? 'queue_music'
                        : item.type === 'song'
                        ? 'music_note'
                        : 'search'}
                    </span>
                  </div>
                )}

                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-semibold text-white truncate">
                    {highlightMatch(item.title, trimmedQuery)}
                  </span>
                  {item.subtitle && (
                    <span className="text-[11px] text-zinc-400 truncate">
                      {item.subtitle}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 uppercase tracking-wider">
                  {item.type}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onInsertQuery(item.targetQuery || item.title);
                  }}
                  title="Insert into search"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/[0.06] cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined floating-icon text-[16px]">north_west</span>
                </button>
              </div>
            </div>
          ))}

          {extraOnlineQueries.map((q) => (
            <div
              key={q}
              onClick={() => onSelectQuery(q)}
              className="flex items-center justify-between px-2.5 py-2 hover:bg-white/[0.1] hover:shadow-lg hover:scale-[1.01] transition-all duration-200 rounded-xl group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-outlined floating-icon text-[#71717a] group-hover:text-[var(--color-primary)] text-[18px]">
                  search
                </span>
                <span className="text-[13px] text-[#e4e1e7] truncate group-hover:text-white">
                  {highlightMatch(q, trimmedQuery)}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onInsertQuery(q);
                }}
                title="Insert into search"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#71717a] hover:text-[#e4e1e7] hover:bg-white/[0.06] cursor-pointer transition-colors shrink-0"
              >
                <span className="material-symbols-outlined floating-icon text-[16px]">north_west</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
