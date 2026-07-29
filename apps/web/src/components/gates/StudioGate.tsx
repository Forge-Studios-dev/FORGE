'use client';

import Link from 'next/link';
import { Icon, PageHeader } from '@forge/design-system';
import { useAuth } from '@/lib/auth';
import { useStudioAccess } from '@/hooks/useStudioAccess';

type GateVariant = {
  title: string;
  subtitle: string;
  icon: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
};

function GateCard({ title, subtitle, icon, primary, secondary }: GateVariant) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-5 py-16 md:px-12">
      <div className="glass-panel w-full rounded-3xl p-8 text-center md:p-10">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Icon name={icon} className="text-3xl" />
        </span>
        <PageHeader title={title} subtitle={subtitle} />
        <div className="mt-8 flex flex-col items-center gap-3">
          {primary ? (
            <Link
              href={primary.href}
              className="primary-button inline-flex rounded-full px-8 py-3 font-semibold text-on-primary"
            >
              {primary.label}
            </Link>
          ) : null}
          {secondary ? (
            <Link href={secondary.href} className="text-sm text-primary hover:underline">
              {secondary.label}
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}

/**
 * Studio gate: guests sign in; pending/rejected see status; approved creators enter;
 * viewers with delegated community roles enter a restricted collaborator Studio.
 */
export function StudioGate({ children }: { children: React.ReactNode }) {
  const { isGuest, accessTier, isPlatformAdmin, isCreator } = useAuth();
  const { mode, isLoading } = useStudioAccess();

  if (isPlatformAdmin) {
    return (
      <GateCard
        icon="admin_panel_settings"
        title="Not available"
        subtitle="Platform administrator accounts are separate from the public site. Sign in with your admin credentials on the dedicated admin application."
      />
    );
  }

  if (isGuest) {
    return (
      <GateCard
        icon="lock"
        title="Creator Studio"
        subtitle="Sign in to manage your channel, upload lessons, go live, and grow memberships."
        primary={{ href: '/login?next=/studio', label: 'Sign in' }}
        secondary={{ href: '/signup?next=/studio', label: 'Create an account' }}
      />
    );
  }

  if (accessTier === 'creator_pending') {
    return (
      <GateCard
        icon="hourglass_top"
        title="Application under review"
        subtitle="Like YouTube Partner Program review — you can still watch and engage while we review your channel application."
        primary={{ href: '/waiting-approval', label: 'View application status' }}
        secondary={{ href: '/', label: 'Back to home' }}
      />
    );
  }

  if (accessTier === 'creator_rejected') {
    return (
      <GateCard
        icon="cancel"
        title="Application not approved"
        subtitle="Your creator application was not approved at this time. Review feedback and re-apply when you are ready."
        primary={{ href: '/approval-rejected', label: 'Learn more & re-apply' }}
        secondary={{ href: '/', label: 'Back to home' }}
      />
    );
  }

  if (isCreator || mode === 'creator' || mode === 'collaborator') {
    return <>{children}</>;
  }

  if (accessTier === 'viewer' && (isLoading || mode === 'loading')) {
    return (
      <main className="mx-auto flex min-h-[40vh] max-w-xl items-center justify-center px-5 py-16">
        <p className="text-sm text-on-surface-variant">Checking Studio access…</p>
      </main>
    );
  }

  if (accessTier === 'viewer') {
    return (
      <GateCard
        icon="rocket_launch"
        title="Become a creator"
        subtitle="Upload lessons, go live, run communities, and unlock analytics. Apply to open Creator Studio — same idea as starting a YouTube channel."
        primary={{ href: '/upload/become-creator', label: 'Apply to become a creator' }}
        secondary={{ href: '/discover/courses', label: 'Explore creator courses' }}
      />
    );
  }

  return <>{children}</>;
}
