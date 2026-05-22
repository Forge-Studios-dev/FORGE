'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@forge/design-system';

export default function UploadError({
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
    <main className="mx-auto max-w-lg px-5 py-16 text-center">
      <div className="glass-panel rounded-2xl p-10">
        <Icon name="error" className="mb-6 text-5xl text-primary" />
        <h1 className="font-display-forge mb-3 text-2xl font-bold">Upload error</h1>
        <p className="mb-8 text-on-surface-variant">
          {error.message || 'The upload flow hit an unexpected error.'}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="primary-button rounded-full px-8 py-3 font-semibold text-on-primary"
          >
            Try again
          </button>
          <Link
            href="/studio/videos"
            className="inline-flex items-center justify-center rounded-full border border-outline px-8 py-3 font-semibold hover:bg-surface-container"
          >
            My videos
          </Link>
        </div>
      </div>
    </main>
  );
}
