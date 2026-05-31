'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

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
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-zinc-700 px-4 py-2 text-sm hover:bg-zinc-600"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
