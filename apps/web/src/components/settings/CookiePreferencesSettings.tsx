'use client';

import { useEffect, useState } from 'react';
import { Button } from '@forge/design-system';
import {
  analyticsConsentGranted,
  isDoNotTrackEnabled,
  readCookieConsent,
  writeCookieConsent,
  type CookieConsentValue,
} from '@/lib/cookie-consent';

/** Change optional analytics cookies after the first-visit banner choice. */
export function CookiePreferencesSettings() {
  const [choice, setChoice] = useState<CookieConsentValue | null>(null);
  const [dnt, setDnt] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setChoice(readCookieConsent());
    setDnt(isDoNotTrackEnabled());
  }, []);

  const save = (value: CookieConsentValue) => {
    writeCookieConsent(value);
    setChoice(value);
    setSaved(true);
  };

  const analyticsOn = analyticsConsentGranted();

  return (
    <section className="glass-panel mt-8 rounded-2xl p-6" id="cookies">
      <h2 className="font-display-forge text-lg font-semibold">Cookies & analytics</h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        Essential cookies keep you signed in. Optional product analytics are off unless you accept
        them. Browser Do Not Track also blocks analytics even if you previously accepted.
      </p>
      {dnt ? (
        <p className="mt-2 text-sm text-secondary" role="status">
          Do Not Track is on in this browser — analytics stay off.
        </p>
      ) : null}
      <p className="mt-2 text-sm text-on-surface-variant">
        Current: {choice === 'accepted' ? 'Analytics accepted' : choice === 'essential' ? 'Essential only' : 'Not set'}
        {choice === 'accepted' && !analyticsOn ? ' (analytics suppressed by DNT)' : ''}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={choice === 'essential' ? 'primary' : 'secondary'}
          onClick={() => save('essential')}
        >
          Essential only
        </Button>
        <Button
          type="button"
          variant={choice === 'accepted' ? 'primary' : 'secondary'}
          onClick={() => save('accepted')}
          disabled={dnt}
        >
          Accept analytics
        </Button>
      </div>
      {saved ? (
        <p className="mt-2 text-sm text-secondary" role="status">
          Preference saved.
        </p>
      ) : null}
    </section>
  );
}
