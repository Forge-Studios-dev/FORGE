import { isFeatureEnabled, parseFeatureFlags } from '@forge/shared-types';

const envFlags = parseFeatureFlags(process.env.NEXT_PUBLIC_FEATURE_FLAGS);

let remoteFlags: string[] | null = null;

/** Client-side flags from build-time env (NEXT_PUBLIC_FEATURE_FLAGS). */
export function getClientFeatureFlags(): string[] {
  return envFlags;
}

export function isClientFeatureEnabled(name: string): boolean {
  return isFeatureEnabled(envFlags, name);
}

/** Merge remote flags from GET /platform/config (cached per session). */
export async function loadRemoteFeatureFlags(): Promise<string[]> {
  if (remoteFlags) return remoteFlags;
  try {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const res = await fetch(`${base}/platform/config`, { next: { revalidate: 300 } });
    if (!res.ok) return envFlags;
    const json = (await res.json()) as { data?: { featureFlags?: string[] } };
    const flags = json.data?.featureFlags ?? [];
    remoteFlags = [...new Set([...envFlags, ...flags])];
    return remoteFlags;
  } catch {
    return envFlags;
  }
}

export function isFeatureEnabledMerged(flags: readonly string[], name: string): boolean {
  return isFeatureEnabled(flags, name);
}
