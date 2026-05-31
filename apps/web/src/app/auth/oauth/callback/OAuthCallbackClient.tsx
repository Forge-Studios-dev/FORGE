'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { persistAuthSession } from '@/lib/auth-storage';

export function OAuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const sessionId = searchParams.get('sessionId') ?? undefined;
    const userRaw = searchParams.get('user');
    if (!accessToken || !userRaw) {
      setError('OAuth sign-in failed. Missing tokens.');
      return;
    }
    try {
      const user = JSON.parse(decodeURIComponent(userRaw));
      persistAuthSession(accessToken, undefined, JSON.stringify(user), sessionId);
      router.replace('/');
    } catch {
      setError('OAuth sign-in failed. Invalid response.');
    }
  }, [router, searchParams]);

  if (error) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-on-surface-variant">{error}</p>
        <a href="/login" className="mt-4 inline-block text-primary">
          Back to login
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center text-on-surface-variant">
      Completing sign-in…
    </main>
  );
}
