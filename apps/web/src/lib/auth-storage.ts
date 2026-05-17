import { setAuthCookie, clearAuthCookie } from '@/lib/auth-cookies';

export const AUTH_SESSION_EVENT = 'forge:auth-session-changed';

const ACCESS_KEY = 'forge_access_token';
const REFRESH_KEY = 'forge_refresh_token';
const USER_KEY = 'forge_user';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

function notifyAuthSessionChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_EVENT));
  }
}

export function persistAuthSession(accessToken: string, refreshToken: string, userJson?: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  if (userJson) localStorage.setItem(USER_KEY, userJson);
  setAuthCookie(accessToken);
  notifyAuthSessionChanged();
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  clearAuthCookie();
  notifyAuthSessionChanged();
}

/** Keep middleware cookie in sync when only localStorage has a token. */
export function syncAuthCookieFromStorage() {
  const token = getAccessToken();
  if (token) setAuthCookie(token);
}
