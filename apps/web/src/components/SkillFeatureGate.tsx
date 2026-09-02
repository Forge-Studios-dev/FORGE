'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSkillFeatures } from '@/hooks/useSkillFeatures';

/** Redirects away when a skill feature flag is off (API 410 otherwise). */
export function SkillFeatureGate({
  feature,
  children,
  fallbackHref = '/studio',
}: {
  feature: 'courses' | 'mentorship' | 'channelPoints';
  children: React.ReactNode;
  fallbackHref?: string;
}) {
  const router = useRouter();
  const { isLoading, coursesEnabled, mentorshipEnabled, channelPointsEnabled } = useSkillFeatures();

  const enabled =
    feature === 'courses'
      ? coursesEnabled
      : feature === 'mentorship'
        ? mentorshipEnabled
        : channelPointsEnabled;

  useEffect(() => {
    if (!isLoading && !enabled) {
      router.replace(fallbackHref);
    }
  }, [isLoading, enabled, router, fallbackHref]);

  if (isLoading || !enabled) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-sm text-on-surface-variant">Loading…</p>
      </main>
    );
  }

  return <>{children}</>;
}
