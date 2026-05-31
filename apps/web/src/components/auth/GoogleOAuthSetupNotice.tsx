'use client';

import type { PlatformPublicConfig } from '@forge/shared-types';

function isLocalDevApi(): boolean {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '';
  return base.includes('localhost') || base.includes('127.0.0.1');
}

/**
 * Dev-only hint when Vercel shows the Google button but local API has no OAuth secrets.
 * Never shown on production (forgestudios.net) — end users must not see Fly/env docs.
 */
export function GoogleOAuthSetupNotice({ config }: { config: PlatformPublicConfig }) {
  if (config.auth?.googleOAuth === true) {
    return null;
  }
  if (!isLocalDevApi()) {
    return null;
  }
  if (process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED !== 'true') {
    return null;
  }

  return (
    <p className="rounded-lg bg-secondary/10 px-4 py-2 text-xs text-on-surface-variant" role="status">
      Local dev: enable Google OAuth on the API (<code>GOOGLE_OAUTH_ENABLED</code> and client credentials
      in <code>apps/api/.env</code>). See <code className="text-xs">docs/auth-enterprise/ENABLEMENT_GUIDE.md</code>.
    </p>
  );
}
