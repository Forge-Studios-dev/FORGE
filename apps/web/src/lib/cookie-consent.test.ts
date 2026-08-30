import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COOKIE_CONSENT_KEY,
  analyticsConsentGranted,
  isDoNotTrackEnabled,
  readCookieConsent,
  writeCookieConsent,
} from './cookie-consent';

describe('cookie-consent', () => {
  afterEach(() => {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    vi.unstubAllGlobals();
  });

  it('returns null when unset', () => {
    expect(readCookieConsent()).toBeNull();
    expect(analyticsConsentGranted()).toBe(false);
  });

  it('treats accepted as analytics allowed', () => {
    writeCookieConsent('accepted');
    expect(readCookieConsent()).toBe('accepted');
    expect(analyticsConsentGranted()).toBe(true);
  });

  it('treats essential as analytics blocked', () => {
    writeCookieConsent('essential');
    expect(readCookieConsent()).toBe('essential');
    expect(analyticsConsentGranted()).toBe(false);
  });

  it('ignores unknown stored values', () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'weird');
    expect(readCookieConsent()).toBeNull();
  });

  it('blocks analytics when Do Not Track is set', () => {
    writeCookieConsent('accepted');
    vi.stubGlobal('navigator', { ...navigator, doNotTrack: '1' });
    expect(isDoNotTrackEnabled()).toBe(true);
    expect(analyticsConsentGranted()).toBe(false);
  });

  it('blocks analytics when Global Privacy Control is set', () => {
    writeCookieConsent('accepted');
    vi.stubGlobal('navigator', { ...navigator, globalPrivacyControl: true });
    expect(isDoNotTrackEnabled()).toBe(true);
    expect(analyticsConsentGranted()).toBe(false);
  });
});
