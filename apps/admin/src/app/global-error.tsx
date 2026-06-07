'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import './globals.css';

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
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-on-background">
        <h2 className="font-display-forge text-lg font-semibold">Something went wrong</h2>
        <p className="max-w-md text-center text-sm text-on-surface-variant">
          An unexpected error occurred. You can try again or return to the dashboard.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="primary-button rounded-full px-5 py-2 text-sm font-semibold text-on-primary"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
