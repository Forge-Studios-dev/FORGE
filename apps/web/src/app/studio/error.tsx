'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import Link from 'next/link';
import { Button, Icon } from '@forge/design-system';

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-lg px-5 py-16 text-center">
      <div className="glass-panel rounded-2xl p-10">
        <Icon name="error" className="mb-6 text-5xl text-primary" />
        <h1 className="font-display-forge mb-3 text-2xl font-bold">Studio error</h1>
        <p className="mb-8 text-on-surface-variant">
          {error.message || 'Something went wrong in Creator Studio.'}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button type="button" variant="primary" onClick={() => reset()} className="px-8 py-3">
            Try again
          </Button>
          <Link
            href="/studio"
            className="inline-flex items-center justify-center rounded-full border border-outline px-8 py-3 font-semibold hover:bg-surface-container"
          >
            Studio home
          </Link>
        </div>
      </div>
    </main>
  );
}
