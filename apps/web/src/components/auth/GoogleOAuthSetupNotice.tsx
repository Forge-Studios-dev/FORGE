'use client';

import type { PlatformPublicConfig } from '@forge/shared-types';
import { isGoogleOAuthEnabled } from '@/lib/platform-config';

/**
 * Shown when the Google button is visible (Vercel env) but API has not enabled Passport Google OAuth.
 */
export function GoogleOAuthSetupNotice({ config }: { config: PlatformPublicConfig }) {
  const envForce =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true';
  const apiEnabled = config.auth?.googleOAuth === true;
  if (!envForce || apiEnabled) {
    return null;
  }

  return (
    <p className="rounded-lg bg-secondary/10 px-4 py-2 text-xs text-on-surface-variant" role="status">
      Google sign-in requires API OAuth secrets on Fly (<code>GOOGLE_OAUTH_ENABLED</code> and client
      credentials). See <code className="text-xs">docs/auth-enterprise/ENABLEMENT_GUIDE.md</code>.
    </p>
  );
}
