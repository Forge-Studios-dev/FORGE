import { Suspense } from 'react';
import { ShortsFeed } from '@/components/shorts/ShortsFeed';

export default function ShortsPage() {
  return (
    <main className="mx-auto w-full max-w-[var(--spacing-container-max)] px-0 py-0 md:px-4 md:py-4">
      <h1 className="sr-only">Shorts</h1>
      <Suspense
        fallback={
          <div className="flex h-dvh items-center justify-center">
            <div className="aspect-[9/16] h-full max-h-full w-full max-w-[420px] animate-pulse rounded-2xl bg-surface-container-high" />
          </div>
        }
      >
        <ShortsFeed />
      </Suspense>
    </main>
  );
}
