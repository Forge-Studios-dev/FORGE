'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@forge/design-system';
import {
  type CookieConsentValue,
  readCookieConsent,
  writeCookieConsent,
} from '@/lib/cookie-consent';

/**
 * Bottom banner for analytics/optional cookie choice.
 * Essential cookies (auth/session) are always used; product analytics wait for Accept.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readCookieConsent() === null);
  }, []);

  const choose = (value: CookieConsentValue) => {
    writeCookieConsent(value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-outline-variant/30 bg-surface-container-high/95 p-4 shadow-lg backdrop-blur-sm"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p id="cookie-consent-title" className="text-sm font-semibold text-on-surface">
            Cookies & analytics
          </p>
          <p id="cookie-consent-desc" className="mt-1 text-sm text-on-surface-variant">
            We use essential cookies to keep you signed in. Optional product analytics help us
            improve FORGE. See our{' '}
            <Link href="/privacy#cookies" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            . Change this later in{' '}
            <Link href="/profile/settings#cookies" className="text-primary hover:underline">
              Settings
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => choose('essential')}>
            Essential only
          </Button>
          <Button type="button" variant="primary" onClick={() => choose('accepted')}>
            Accept analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
