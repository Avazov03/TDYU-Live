export type SearchHistoryEntry = {
  query: string;
  thumbnail?: string;
  videoId?: string;
  at: number;
};

const STORAGE_KEY = "ot-search-history";
const MAX_ITEMS = 15;

export function readSearchHistory(): SearchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SearchHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSearchHistory(entry: Omit<SearchHistoryEntry, "at">) {
  if (typeof window === "undefined") return;
  const query = entry.query.trim();
  if (!query) return;

  const prev = readSearchHistory().filter(
    (item) => item.query.toLowerCase() !== query.toLowerCase(),
  );
  const next: SearchHistoryEntry[] = [
    { ...entry, query, at: Date.now() },
    ...prev,
  ].slice(0, MAX_ITEMS);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function removeSearchHistoryItem(query: string) {
  if (typeof window === "undefined") return;
  const next = readSearchHistory().filter(
    (item) => item.query.toLowerCase() !== query.toLowerCase(),
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
