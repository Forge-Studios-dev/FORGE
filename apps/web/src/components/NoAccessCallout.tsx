'use client';

import Link from 'next/link';
import { loginHrefWithNext, currentReturnPath } from '@/lib/safe-return-path';

export function NoAccessCallout({
  title = 'You don’t have access',
  description = 'Your account does not have permission to view this content.',
}: {
  title?: string;
  description?: string;
}) {
  const signInHref = loginHrefWithNext(currentReturnPath());

  return (
    <div className="glass-panel rounded-2xl border border-outline-variant/40 p-6">
      <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
      <p className="mt-1 text-on-surface-variant">{description}</p>
      <div className="mt-4 flex gap-3">
        <Link
          href="/"
          className="rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 py-2 font-semibold text-on-surface transition hover:bg-surface-container-highest"
        >
          Go home
        </Link>
        <Link
          href={signInHref}
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary transition hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
