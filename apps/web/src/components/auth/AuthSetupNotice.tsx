'use client';

import type { PlatformPublicConfig } from '@forge/shared-types';
import { isMailConfigured } from '@forge/shared-types';

/** Shown on signup when API reports SMTP is not configured. */
export function AuthSetupNotice({ config }: { config: PlatformPublicConfig }) {
  if (isMailConfigured(config)) {
    return null;
  }

  return (
    <p
      className="rounded-lg border border-outline bg-surface-container px-4 py-3 text-sm text-on-surface-variant"
      role="status"
    >
      Verification emails are not configured on this API (SMTP missing). Sign-up may succeed without an
      inbox message — check API logs for the link, or configure SMTP (
      <code className="text-xs">docs/auth-enterprise/ENABLEMENT_GUIDE.md</code>).
    </p>
  );
}
