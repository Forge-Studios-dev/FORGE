'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Icon } from '@forge/design-system';

export default function GlobalError({
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
    <main className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <div className="glass-panel max-w-md rounded-2xl p-10">
        <Icon name="error" className="mb-6 text-5xl text-primary" />
        <h1 className="font-display-forge mb-3 text-2xl font-bold">Something went wrong</h1>
        <p className="mb-8 text-on-surface-variant">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="primary-button rounded-full px-8 py-3 font-semibold text-on-primary"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
