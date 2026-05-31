import type { PlatformPublicConfig } from '@forge/shared-types';

/** Server-side platform config (login/signup SSR — no client flash). */
export async function getServerPlatformConfig(): Promise<PlatformPublicConfig> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  try {
    const res = await fetch(`${base}/platform/config`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('platform config failed');
    const json = (await res.json()) as { data?: PlatformPublicConfig };
    return {
      featureFlags: json.data?.featureFlags ?? [],
      apiVersion: json.data?.apiVersion ?? 'v1',
      auth: json.data?.auth,
      firebase: json.data?.firebase,
    };
  } catch {
    return { featureFlags: [], apiVersion: 'v1' };
  }
}
