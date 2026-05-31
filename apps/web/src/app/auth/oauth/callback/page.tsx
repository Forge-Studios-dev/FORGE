import { Suspense } from 'react';
import { OAuthCallbackClient } from './OAuthCallbackClient';

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<main className="px-6 py-16 text-center text-on-surface-variant">Loading…</main>}>
      <OAuthCallbackClient />
    </Suspense>
  );
}
