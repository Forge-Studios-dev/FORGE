import type { PlatformPublicConfig } from '@forge/shared-types';

export type {
  PlatformAuthConfig,
  PlatformFirebaseConfig,
  PlatformPublicConfig,
} from '@forge/shared-types';

let cached: PlatformPublicConfig | null = null;

/** Fetch public platform config (auth + firebase capability flags). */
export async function loadPlatformConfig(): Promise<PlatformPublicConfig> {
  if (cached?.auth) return cached;
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  try {
    const res = await fetch(`${base}/platform/config`, { cache: 'no-store' });
    if (!res.ok) throw new Error('platform config failed');
    const json = (await res.json()) as { data?: PlatformPublicConfig };
    const cfg: PlatformPublicConfig = {
      featureFlags: json.data?.featureFlags ?? [],
      apiVersion: json.data?.apiVersion ?? 'v1',
      auth: json.data?.auth,
      firebase: json.data?.firebase,
      billing: json.data?.billing,
    };
    if (cfg.auth) cached = cfg;
    return cfg;
  } catch {
    return { featureFlags: [], apiVersion: 'v1' };
  }
}

export function isGoogleOAuthEnabled(config: PlatformPublicConfig): boolean {
  if (process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true') return true;
  return config.auth?.googleOAuth === true;
}

export function isEmailOtpVerificationEnabled(config: PlatformPublicConfig): boolean {
  return config.auth?.otpVerification === true;
}

export {
  isStripeBillingEnabled,
  isMockSubscriptionsEnabled,
} from '@forge/shared-types';
