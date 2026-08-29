'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button, Icon } from '@forge/design-system';

export default function AdminError({
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
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <div className="glass-panel max-w-md rounded-2xl p-10">
        <Icon name="error" className="mb-6 text-5xl text-primary" />
        <h1 className="font-display-forge mb-3 text-2xl font-bold">Admin error</h1>
        <p className="mb-8 text-on-surface-variant">
          {error.message || 'Something went wrong loading this admin view.'}
        </p>
        <Button type="button" variant="primary" onClick={() => reset()} className="!px-8 !py-3">
          Try again
        </Button>
      </div>
    </main>
  );
}
