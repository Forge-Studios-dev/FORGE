'use client';

import Link from 'next/link';
import { Icon, PageHeader } from '@forge/design-system';

/** Shown when a collaborator opens a creator-only Studio route. */
export function StudioCollaboratorDenied({
  title = 'Creator tools only',
  subtitle = 'This part of Studio is reserved for the channel owner. You still have access to moderation and messages.',
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <main className="space-y-6">
      <div className="glass-panel rounded-2xl p-8 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Icon name="lock" className="text-2xl" />
        </span>
        <PageHeader title={title} subtitle={subtitle} />
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/studio/moderation"
            className="primary-button inline-flex rounded-full px-5 py-2.5 text-sm font-semibold text-on-primary"
          >
            Open moderation
          </Link>
          <Link href="/studio" className="text-sm text-primary hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
