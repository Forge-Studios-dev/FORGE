'use client';

import type { PlatformPublicConfig } from '@forge/shared-types/platform-public-config';
import { isMailConfigured } from '@forge/shared-types/platform-public-config';

function isLocalDevApi(): boolean {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '';
  return base.includes('localhost') || base.includes('127.0.0.1');
}

/** Dev-only: signup when local API has no SMTP. */
export function AuthSetupNotice({ config }: { config: PlatformPublicConfig }) {
  if (isMailConfigured(config)) {
    return null;
  }
  if (!isLocalDevApi()) {
    return null;
  }

  return (
    <p
      className="rounded-lg border border-outline bg-surface-container px-4 py-3 text-sm text-on-surface-variant"
      role="status"
    >
      Verification emails are not configured on this API (SMTP missing). Sign-up may succeed without an
      inbox message — check API logs for the link, or configure SMTP (
      <code className="text-xs">docs/AUTH.md</code>).
    </p>
  );
}
