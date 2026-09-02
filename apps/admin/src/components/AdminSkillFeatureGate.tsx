'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  isChannelPointsFeatureEnabled,
  isCoursesFeatureEnabled,
  isMentorshipFeatureEnabled,
  type PlatformPublicConfig,
} from '@forge/shared-types';
import { fetchAdminPlatformConfig } from '@/lib/platform-config';

type AdminSkillFeature = 'courses' | 'mentorship' | 'channelPoints';

/** Redirects to dashboard when a skill feature flag is off (API returns 410 otherwise). */
export function AdminSkillFeatureGate({
  feature,
  children,
}: {
  feature: AdminSkillFeature;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<PlatformPublicConfig | null>(null);

  useEffect(() => {
    void fetchAdminPlatformConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (!config) return;
    const enabled =
      feature === 'courses'
        ? isCoursesFeatureEnabled(config)
        : feature === 'mentorship'
          ? isMentorshipFeatureEnabled(config)
          : isChannelPointsFeatureEnabled(config);
    if (!enabled) router.replace('/dashboard');
  }, [config, feature, router]);

  if (!config) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8">
        <p className="text-sm text-on-surface-variant">Loading…</p>
      </main>
    );
  }

  const enabled =
    feature === 'courses'
      ? isCoursesFeatureEnabled(config)
      : feature === 'mentorship'
        ? isMentorshipFeatureEnabled(config)
        : isChannelPointsFeatureEnabled(config);

  if (!enabled) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8">
        <p className="text-sm text-on-surface-variant">Redirecting…</p>
      </main>
    );
  }

  return <>{children}</>;
}
