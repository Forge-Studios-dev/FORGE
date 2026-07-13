const ADMIN_TOKEN_KEY = 'forge_admin_token';

let memoryAccessToken: string | null = null;

export function getAdminAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (memoryAccessToken) return memoryAccessToken;
  try {
    const fromTab = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (fromTab) {
      memoryAccessToken = fromTab;
      return fromTab;
    }
  } catch {
    /* private mode */
  }
  return null;
}

/**
 * forge_admin_token / forge_admin_session are now HttpOnly cookies set by the
 * API on login/refresh (MED-10) — client JS only keeps the sessionStorage
 * bridge for Authorization headers, it never writes those cookies itself.
 */
export function persistAdminSession(accessToken: string) {
  memoryAccessToken = accessToken;
  try {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, accessToken);
  } catch {
    /* ignore */
  }
}

export function clearAdminSession() {
  memoryAccessToken = null;
  try {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* ignore */
  }
  // forge_admin_token / forge_admin_session cookies are cleared server-side by /auth/logout.
}
