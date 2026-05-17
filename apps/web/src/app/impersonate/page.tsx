'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { persistAuthSession } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth';
import { AuthTokens } from '@/types';

function ImpersonateContent() {
  const router = useRouter();
  const { refresh } = useAuth();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'ok' | 'err'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token || token.length < 16) {
      setStatus('err');
      setMessage('Missing or invalid impersonation token.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.post<{ data: AuthTokens }>('/auth/impersonate', { token });
        if (cancelled) return;
        persistAuthSession(
          data.data.accessToken,
          data.data.refreshToken,
          JSON.stringify(data.data.user),
        );
        refresh();
        setStatus('ok');
        setMessage(`Signed in as ${data.data.user.displayName}. Redirecting…`);
        setTimeout(() => router.replace('/'), 800);
      } catch (err: unknown) {
        if (cancelled) return;
        setStatus('err');
        const m = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setMessage(typeof m === 'string' ? m : 'Impersonation link expired or invalid.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router, refresh]);

  return (
    <div className="glass-panel mx-auto max-w-md space-y-4 rounded-2xl p-8 text-center">
      {status === 'loading' && <p className="text-on-surface-variant">Signing you in…</p>}
      {status === 'ok' && <p className="text-secondary">{message}</p>}
      {status === 'err' && (
        <>
          <p className="text-error font-medium">Could not sign in</p>
          <p className="text-sm text-on-surface-variant">{message}</p>
          <Link href="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
            Go to login
          </Link>
        </>
      )}
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <ImpersonateContent />
      </Suspense>
    </div>
  );
}
