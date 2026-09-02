import type { PlatformPublicConfig, PlatformSkillFeatures } from '@forge/shared-types';

const defaultSkillFeatures: PlatformSkillFeatures = {
  courses: false,
  mentorship: false,
  channelPoints: false,
  skillEconomyLms: false,
};

/** Fetch public platform config for admin nav gating. */
export async function fetchAdminPlatformConfig(): Promise<PlatformPublicConfig> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  try {
    const res = await fetch(`${base}/platform/config`, { cache: 'no-store' });
    if (!res.ok) throw new Error('platform config failed');
    const json = (await res.json()) as { data?: PlatformPublicConfig };
    return {
      featureFlags: json.data?.featureFlags ?? [],
      apiVersion: json.data?.apiVersion ?? 'v1',
      skillFeatures: json.data?.skillFeatures ?? defaultSkillFeatures,
    };
  } catch {
    return { featureFlags: [], apiVersion: 'v1', skillFeatures: defaultSkillFeatures };
  }
}
