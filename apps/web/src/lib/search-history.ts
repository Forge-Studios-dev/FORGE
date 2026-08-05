const STORAGE_KEY = 'forge.searchHistory';
const MAX_ITEMS = 8;

export function readSearchHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      .map((q) => q.trim())
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function pushSearchHistory(query: string): string[] {
  const term = query.trim();
  if (!term || typeof window === 'undefined') return readSearchHistory();
  const next = [term, ...readSearchHistory().filter((q) => q.toLowerCase() !== term.toLowerCase())].slice(
    0,
    MAX_ITEMS,
  );
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  return next;
}

export function clearSearchHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
