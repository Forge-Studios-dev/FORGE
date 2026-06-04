/** Default page size for list endpoints (F-602). */
export const DEFAULT_LIST_LIMIT = 20;

/** Hard cap — prevents unbounded DB reads / large payloads. */
export const MAX_LIST_LIMIT = 50;

export function clampPage(page: unknown, fallback = 1): number {
  const n = typeof page === 'number' ? page : parseInt(String(page ?? fallback), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function clampLimit(
  limit: unknown,
  fallback = DEFAULT_LIST_LIMIT,
  max = MAX_LIST_LIMIT,
): number {
  const n = typeof limit === 'number' ? limit : parseInt(String(limit ?? fallback), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}
