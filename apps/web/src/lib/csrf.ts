/** Double-submit CSRF token (F-802) — must match forge_csrf cookie on cookie-based refresh. */
export function readCsrfTokenFromDocument(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)forge_csrf=([^;]*)/);
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
