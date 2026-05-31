'use client';

import type { PlatformPublicConfig } from '@forge/shared-types';

/** Shown when Firebase complement (FCM/App Check) is not configured on the API. */
export function FirebaseSetupNotice({ config }: { config: PlatformPublicConfig }) {
  if (config.firebase?.adminConfigured === true) {
    return null;
  }

  return (
    <p
      className="rounded-lg border border-outline/80 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant"
      role="status"
    >
      Firebase is not connected to this API yet (no Admin SDK on the server). Push notifications and
      App Check are off until <code className="text-xs">FIREBASE_*</code> secrets are set on Fly.
      See <code className="text-xs">docs/auth-enterprise/FIREBASE_CONNECTION_BLOCKER.md</code>.
    </p>
  );
}
