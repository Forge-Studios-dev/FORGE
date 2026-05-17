'use client';

import Link from 'next/link';
import { PageHeader } from '@forge/design-system';
import { useAuth } from '@/lib/auth';

/**
 * YouTube Studio gate: guests sign in; viewers apply; pending/rejected see status; approved creators enter studio.
 */
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3002';

export function StudioGate({ children }: { children: React.ReactNode }) {
  const { isGuest, accessTier, isPlatformAdmin } = useAuth();

  if (isPlatformAdmin) {
    return (
      <main className="mx-auto max-w-lg px-5 py-20 text-center md:px-12">
        <PageHeader
          title="Platform admin"
          subtitle="Like YouTube internal tools — moderation and user management live in the admin panel, not Creator Studio on the public site."
        />
        <a
          href={ADMIN_URL}
          className="primary-button mt-6 inline-block rounded-full px-8 py-3 font-semibold text-on-primary"
        >
          Open admin panel
        </a>
      </main>
    );
  }

  if (isGuest) {
    return (
      <main className="mx-auto max-w-lg px-5 py-20 text-center md:px-12">
        <PageHeader title="Creator Studio" subtitle="Sign in to manage your channel or apply to become a creator" />
        <Link href="/login?next=/studio" className="primary-button inline-block rounded-full px-8 py-3 font-semibold text-on-primary">
          Sign in
        </Link>
      </main>
    );
  }

  if (accessTier === 'creator_pending') {
    return (
      <main className="mx-auto max-w-lg px-5 py-20 text-center md:px-12">
        <PageHeader
          title="Application under review"
          subtitle="Like YouTube Partner Program review — you can still watch and engage while we review your channel application."
        />
        <Link href="/waiting-approval" className="text-primary hover:underline">
          View status
        </Link>
      </main>
    );
  }

  if (accessTier === 'creator_rejected') {
    return (
      <main className="mx-auto max-w-lg px-5 py-20 text-center md:px-12">
        <PageHeader title="Application not approved" subtitle="Your creator application was not approved at this time." />
        <Link href="/approval-rejected" className="text-primary hover:underline">
          Learn more & re-apply
        </Link>
      </main>
    );
  }

  if (accessTier === 'viewer') {
    return (
      <main className="mx-auto max-w-lg px-5 py-20 md:px-12">
        <div className="glass-panel rounded-2xl p-8 text-center">
          <PageHeader
            title="Creator Studio"
            subtitle="Upload lessons, go live, and see channel analytics. Apply to unlock Studio — same idea as starting a YouTube channel."
          />
          <Link href="/upload/become-creator" className="primary-button mt-6 inline-block rounded-full px-8 py-3 font-semibold text-on-primary">
            Become a creator
          </Link>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
