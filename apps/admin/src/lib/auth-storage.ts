const ADMIN_TOKEN_KEY = 'forge_admin_token';
const ADMIN_SESSION_MARKER = 'forge_admin_session';

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

function cookieDomain(): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (host === 'forgestudios.net' || host.endsWith('.forgestudios.net')) {
    return '; domain=.forgestudios.net';
  }
  return '';
}

export function setAdminSessionMarker() {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ADMIN_SESSION_MARKER}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict${secure}${cookieDomain()}`;
}

export function setAdminAccessCookie(token: string) {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ADMIN_TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict${secure}${cookieDomain()}`;
}

export function persistAdminSession(accessToken: string) {
  memoryAccessToken = accessToken;
  try {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, accessToken);
  } catch {
    /* ignore */
  }
  setAdminAccessCookie(accessToken);
  setAdminSessionMarker();
}

export function clearAdminSession() {
  memoryAccessToken = null;
  try {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    const secure =
      typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${ADMIN_TOKEN_KEY}=; path=/; max-age=0; SameSite=Strict${secure}${cookieDomain()}`;
    document.cookie = `${ADMIN_SESSION_MARKER}=; path=/; max-age=0; SameSite=Strict${secure}${cookieDomain()}`;
  }
}
