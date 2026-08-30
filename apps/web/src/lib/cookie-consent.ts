/** localStorage key for optional analytics / non-essential cookie choice. */
export const COOKIE_CONSENT_KEY = 'forge.cookieConsent';

export type CookieConsentValue = 'accepted' | 'essential';

export function readCookieConsent(): CookieConsentValue | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (raw === 'accepted' || raw === 'essential') return raw;
    return null;
  } catch {
    return null;
  }
}

export function writeCookieConsent(value: CookieConsentValue): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Browser Do Not Track (or Global Privacy Control) — treat as analytics opt-out. */
export function isDoNotTrackEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.globalPrivacyControl === true) return true;
  const dnt = nav.doNotTrack ?? (window as Window & { doNotTrack?: string }).doNotTrack;
  return dnt === '1' || dnt === 'yes';
}

/**
 * Product analytics may fire only after Accept and when DNT/GPC is not set.
 * Essential-only / unset / DNT → false.
 */
export function analyticsConsentGranted(): boolean {
  if (isDoNotTrackEnabled()) return false;
  return readCookieConsent() === 'accepted';
}
