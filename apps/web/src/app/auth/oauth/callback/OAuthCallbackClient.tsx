'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { persistAuthSession } from '@/lib/auth-storage';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export function OAuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('OAuth sign-in failed. Missing authorization code.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.post(
          `${API_URL}/auth/oauth/exchange`,
          { code },
          { withCredentials: true },
        );
        const payload = data.data ?? data;
        if (!payload?.accessToken || !payload?.user) {
          throw new Error('Invalid exchange response');
        }
        if (cancelled) return;
        persistAuthSession(
          payload.accessToken,
          undefined,
          JSON.stringify(payload.user),
          payload.sessionId,
        );
        router.replace('/');
      } catch {
        if (!cancelled) {
          setError('OAuth sign-in failed. The link may have expired — try again.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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
