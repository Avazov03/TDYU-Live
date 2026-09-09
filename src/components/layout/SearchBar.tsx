"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { SearchSuggestItem } from "@/app/api/search/suggest/route";
import {
  readSearchHistory,
  removeSearchHistoryItem,
  saveSearchHistory,
  type SearchHistoryEntry,
} from "@/lib/search-history";

type DropdownItem =
  | { kind: "history"; entry: SearchHistoryEntry }
  | { kind: "suggestion"; item: SearchSuggestItem };

export function SearchBar() {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const refreshHistory = useCallback(() => {
    setHistory(readSearchHistory());
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const fetchSuggestions = useCallback(async (value: string) => {
    abortRef.current?.abort();
    if (!value.trim()) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/search/suggest?q=${encodeURIComponent(value.trim())}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as {
        suggestions: SearchSuggestItem[];
        topVideo?: { id: string; thumbnail: string } | null;
      };
      if (!controller.signal.aborted) {
        setSuggestions(data.suggestions ?? []);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSuggestions([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(query);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  const commitSearch = useCallback(
    async (term: string, meta?: { thumbnail?: string; videoId?: string }) => {
      const trimmed = term.trim();
      if (!trimmed) return;

      let thumbnail = meta?.thumbnail;
      let videoId = meta?.videoId;

      if (!thumbnail) {
        const fromSuggestions = suggestions.find((s) => s.type === "video");
        if (fromSuggestions?.type === "video") {
          thumbnail = fromSuggestions.thumbnail;
          videoId = fromSuggestions.id;
        } else {
          try {
            const res = await fetch(
              `/api/search/suggest?q=${encodeURIComponent(trimmed)}`,
            );
            if (res.ok) {
              const data = (await res.json()) as {
                topVideo?: { id: string; thumbnail: string } | null;
              };
              if (data.topVideo) {
                thumbnail = data.topVideo.thumbnail;
                videoId = data.topVideo.id;
              }
            }
          } catch {
            /* ignore */
          }
        }
      }

      saveSearchHistory({ query: trimmed, thumbnail, videoId });
      refreshHistory();
      setQuery(trimmed);
      setOpen(false);
      setFocused(false);
      inputRef.current?.blur();
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    },
    [refreshHistory, router, suggestions],
  );

  const navigateSuggestion = useCallback(
    (item: SearchSuggestItem) => {
      if (item.type === "video") {
        saveSearchHistory({
          query: item.label,
          thumbnail: item.thumbnail,
          videoId: item.id,
        });
        refreshHistory();
        setOpen(false);
        router.push(`/learn/${item.id}`);
        return;
      }
      if (item.type === "teacher") {
        saveSearchHistory({ query: item.label });
        refreshHistory();
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(item.label)}`);
        return;
      }
      void commitSearch(item.label);
    },
    [commitSearch, refreshHistory, router],
  );

  const dropdownItems: DropdownItem[] = query.trim()
    ? suggestions.map((item) => ({ kind: "suggestion" as const, item }))
    : history.map((entry) => ({ kind: "history" as const, entry }));

  const showDropdown = open && (dropdownItems.length > 0 || (query.trim() && loading));

  const onSubmit = () => {
    if (activeIndex >= 0 && dropdownItems[activeIndex]) {
      const row = dropdownItems[activeIndex];
      if (row.kind === "history") {
        void commitSearch(row.entry.query, {
          thumbnail: row.entry.thumbnail,
          videoId: row.entry.videoId,
        });
      } else {
        navigateSuggestion(row.item);
      }
      return;
    }
    void commitSearch(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      setFocused(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, dropdownItems.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  const removeHistory = (e: React.MouseEvent, entry: SearchHistoryEntry) => {
    e.preventDefault();
    e.stopPropagation();
    removeSearchHistoryItem(entry.query);
    refreshHistory();
  };

  return (
    <div className={`search-bar${focused ? " focused" : ""}`} ref={wrapRef}>
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="search-input-box">
          <span className="search-input-icon" aria-hidden>
            <Icon name="search" size={18} />
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Qidiruv"
            value={query}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
              setOpen(true);
            }}
            onFocus={() => {
              setFocused(true);
              setOpen(true);
              refreshHistory();
            }}
            onKeyDown={handleKeyDown}
          />
          {query ? (
            <button
              type="button"
              className="search-clear"
              aria-label="Tozalash"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
            >
              <Icon name="x" size={18} />
            </button>
          ) : null}
        </div>
        <button type="submit" className="search-submit" aria-label="Qidirish">
          <Icon name="search" size={20} />
        </button>
      </form>

      {showDropdown ? (
        <div className="search-dropdown" role="listbox">
          {query.trim() && loading && dropdownItems.length === 0 ? (
            <div className="search-dropdown-empty">Qidirilmoqda...</div>
          ) : null}
          {dropdownItems.map((row, index) => {
            const active = index === activeIndex;
            if (row.kind === "history") {
              const { entry } = row;
              return (
                <button
                  key={`h-${entry.query}-${entry.at}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`search-dropdown-item${active ? " active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    void commitSearch(entry.query, {
                      thumbnail: entry.thumbnail,
                      videoId: entry.videoId,
                    })
                  }
                >
                  <span className="search-dropdown-icon">
                    <Icon name="history" size={18} />
                  </span>
                  <span className="search-dropdown-text">
                    <span className="search-dropdown-label">{entry.query}</span>
                  </span>
                  {entry.thumbnail ? (
                    <img
                      className="search-dropdown-thumb"
                      src={entry.thumbnail}
                      alt=""
                    />
                  ) : null}
                  <span
                    className="search-dropdown-remove"
                    role="button"
                    tabIndex={-1}
                    aria-label="O'chirish"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => removeHistory(e, entry)}
                  >
                    <Icon name="x" size={16} />
                  </span>
                </button>
              );
            }

            const { item } = row;
            const thumb = item.type === "video" ? item.thumbnail : undefined;
            const icon =
              item.type === "teacher"
                ? "users"
                : item.type === "topic"
                  ? "search"
                  : "search";

            return (
              <button
                key={`s-${item.type}-${item.label}-${index}`}
                type="button"
                role="option"
                aria-selected={active}
                className={`search-dropdown-item${active ? " active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => navigateSuggestion(item)}
              >
                <span className="search-dropdown-icon">
                  <Icon name={icon} size={18} />
                </span>
                <span className="search-dropdown-text">
                  <span className="search-dropdown-label">{item.label}</span>
                  {"sublabel" in item && item.sublabel ? (
                    <span className="search-dropdown-sub">{item.sublabel}</span>
                  ) : null}
                </span>
                {thumb ? (
                  <img className="search-dropdown-thumb" src={thumb} alt="" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
