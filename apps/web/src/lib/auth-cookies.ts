const COOKIE_NAME = 'forge_access_token';
const MAX_AGE = 60 * 60 * 24 * 7;

/** Share session across apex + www on production. */
function cookieDomain(): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (host === 'forgestudios.net' || host.endsWith('.forgestudios.net')) {
    return '; domain=.forgestudios.net';
  }
  return '';
}

export function setAuthCookie(token: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${MAX_AGE}; SameSite=Lax${cookieDomain()}`;
}

export function clearAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${cookieDomain()}`;
}
