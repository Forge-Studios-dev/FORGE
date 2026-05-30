/** Max length for `next` return paths (pathname + search). */
export const MAX_RETURN_PATH_LEN = 2048;

/**
 * Sanitize internal return path for post-login redirects.
 * Blocks open redirects (`//`, `http:`) and auth loops.
 */
export function safeReturnPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  if (/^\/\w+:/i.test(trimmed)) return fallback;
  const path = trimmed.length > MAX_RETURN_PATH_LEN ? trimmed.slice(0, MAX_RETURN_PATH_LEN) : trimmed;
  if (path === '/login' || path.startsWith('/login?')) return fallback;
  if (path === '/signup' || path.startsWith('/signup?')) return fallback;
  return path;
}

/** Build login href with a single-encoded `next` param. */
export function loginHrefWithNext(returnPath: string): string {
  const safe = safeReturnPath(returnPath);
  return `/login?next=${encodeURIComponent(safe)}`;
}
