'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { persistAuthSession, getAccessToken, getSessionId } from '@/lib/auth-storage';
import { VerifyEmailPrompt } from '@/components/auth/VerifyEmailPrompt';
import type { User } from '@/types';

function VerifyEmailWithToken() {
  const { refresh } = useAuth();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token || token.length < 16) {
      setStatus('err');
      setMessage('Invalid or missing verification token.');
      return;
    }
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        await api.get('/auth/verify-email', { params: { token } });
        if (cancelled) return;
        setStatus('ok');
        setMessage('Your email is verified. You can continue to FORGE.');
        try {
          const { data } = await api.post<{
            data: { accessToken: string; user: User; sessionId?: string };
          }>('/auth/refresh', {});
          persistAuthSession(
            data.data.accessToken,
            undefined,
            JSON.stringify(data.data.user),
            data.data.sessionId ?? getSessionId() ?? undefined,
          );
          refresh();
        } catch {
          refresh();
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setStatus('err');
          const m = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          setMessage(typeof m === 'string' ? m : 'Verification failed. The link may have expired.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, refresh]);

  return (
    <div className="glass rounded-2xl p-8 space-y-4 text-center">
      {status === 'loading' && <p className="text-on-surface-variant">Verifying your email…</p>}
      {status === 'ok' && (
        <>
          <p className="text-secondary font-medium">Email verified</p>
          <p className="text-on-surface-variant text-sm">{message}</p>
          <Link href="/" className="inline-block mt-4 text-primary hover:underline text-sm font-medium">
            Continue to FORGE
          </Link>
        </>
      )}
      {status === 'err' && (
        <>
          <p className="text-error font-medium">Could not verify</p>
          <p className="text-on-surface-variant text-sm">{message}</p>
          <Link href="/verify-email" className="inline-block mt-4 text-primary hover:underline text-sm font-medium">
            Resend verification
          </Link>
        </>
      )}
    </div>
  );
}

function VerifyEmailPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const welcome = searchParams.get('welcome') === '1';

  if (!token) {
    return <VerifyEmailPrompt welcome={welcome} />;
  }

  return <VerifyEmailWithToken />;
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Suspense fallback={<p className="text-center text-on-surface-variant">Loading…</p>}>
          <VerifyEmailPageContent />
        </Suspense>
      </div>
    </div>
  );
}
