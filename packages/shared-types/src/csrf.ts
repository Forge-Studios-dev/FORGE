/** Double-submit CSRF token — must match forge_csrf cookie on cookie-based refresh. */
export function readCsrfTokenFromDocument(): string | null {
  const doc = (globalThis as { document?: { cookie?: string } }).document;
  const cookie = doc?.cookie;
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)forge_csrf=([^;]*)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function csrfRequestHeaders(): Record<string, string> {
  const token = readCsrfTokenFromDocument();
  return token ? { 'X-Forge-CSRF': token } : {};
}
