const COOKIE_NAME = 'forge_access_token';
const MAX_AGE = 60 * 60 * 24 * 30;

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
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${MAX_AGE}; SameSite=Strict${secure}${cookieDomain()}`;
}

export function clearAuthCookie() {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Strict${secure}${cookieDomain()}`;
}
