'use client';

import { useEffect } from 'react';
import { Icon } from '@forge/design-system';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <div className="glass-panel max-w-md rounded-2xl p-10">
        <Icon name="error" className="mb-6 text-5xl text-primary" />
        <h1 className="font-display-forge mb-3 text-2xl font-bold">Admin error</h1>
        <p className="mb-8 text-on-surface-variant">
          {error.message || 'Something went wrong loading this admin view.'}
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
