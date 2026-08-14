import { Suspense } from 'react';
import { NewPlaylistClient } from './ui';

export default function NewPlaylistPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen">
          <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="glass-panel rounded-2xl border border-outline-variant/20 p-6">
              <div className="h-6 w-40 animate-pulse rounded bg-surface-container-high" />
              <div className="mt-3 h-4 w-72 animate-pulse rounded bg-surface-container-high" />
            </div>
          </div>
        </main>
      }
    >
      <NewPlaylistClient />
    </Suspense>
  );
}

