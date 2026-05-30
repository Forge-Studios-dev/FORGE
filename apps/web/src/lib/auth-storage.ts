import { setAuthCookie, clearAuthCookie } from '@/lib/auth-cookies';

export const AUTH_SESSION_EVENT = 'forge:auth-session-changed';

const USER_KEY = 'forge_user';
const SESSION_ID_KEY = 'forge_session_id';
/** Tab-scoped bridge for access token (not localStorage — reduces persistent XSS exposure). */
const ACCESS_TAB_KEY = 'forge_access_token';

let memoryAccessToken: string | null = null;

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (memoryAccessToken) return memoryAccessToken;
  try {
    const fromTab = sessionStorage.getItem(ACCESS_TAB_KEY);
    if (fromTab) {
      memoryAccessToken = fromTab;
      return fromTab;
    }
  } catch {
    /* private mode */
  }
  return null;
}

export function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_ID_KEY);
}

/** Refresh token is HttpOnly on the API host (`forge_refresh` cookie), not in client storage. */
export function getRefreshToken(): string | null {
  return null;
}

function notifyAuthSessionChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_EVENT));
  }
}

export function persistAuthSession(
  accessToken: string,
  _refreshToken?: string,
  userJson?: string,
  sessionId?: string,
) {
  memoryAccessToken = accessToken;
  try {
    sessionStorage.setItem(ACCESS_TAB_KEY, accessToken);
  } catch {
    /* ignore */
  }
  if (userJson) localStorage.setItem(USER_KEY, userJson);
  if (sessionId) localStorage.setItem(SESSION_ID_KEY, sessionId);
  setAuthCookie(accessToken);
  notifyAuthSessionChanged();
}

export function clearAuthSession() {
  memoryAccessToken = null;
  try {
    sessionStorage.removeItem(ACCESS_TAB_KEY);
  } catch {
    /* ignore */
  }
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem('forge_refresh_token');
  clearAuthCookie();
  notifyAuthSessionChanged();
}

/** Keep middleware cookie in sync with in-memory / sessionStorage access token. */
export function syncAuthCookieFromStorage() {
  const token = getAccessToken();
  if (token) setAuthCookie(token);
}
