import { Suspense } from 'react';
import { NewPlaylistClient } from './ui';

export default function NewPlaylistPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen">
          <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="glass rounded-2xl p-6 border border-white/10">
              <div className="h-6 w-40 bg-white/5 rounded animate-pulse" />
              <div className="h-4 w-72 bg-white/5 rounded animate-pulse mt-3" />
            </div>
          </div>
        </main>
      }
    >
      <NewPlaylistClient />
    </Suspense>
  );
}

