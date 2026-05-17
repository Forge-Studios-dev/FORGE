'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getStoredUser } from '@/lib/permissions';

function VerifyEmailContent() {
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
        if (!cancelled) {
          setStatus('ok');
          setMessage('Your email is verified. You can close this tab or continue to FORGE.');
          const u = getStoredUser();
          if (u) {
            localStorage.setItem('forge_user', JSON.stringify({ ...u, isVerified: true }));
            refresh();
          }
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
  }, [token]);

  return (
    <div className="glass rounded-2xl p-8 space-y-4 text-center">
      {status === 'loading' && <p className="text-gray-300">Verifying your email…</p>}
      {status === 'ok' && (
        <>
          <p className="text-emerald-400 font-medium">Email verified</p>
          <p className="text-gray-300 text-sm">{message}</p>
        </>
      )}
      {status === 'err' && (
        <>
          <p className="text-red-400 font-medium">Could not verify</p>
          <p className="text-gray-300 text-sm">{message}</p>
        </>
      )}
      <Link href="/" className="inline-block mt-4 text-forge-500 hover:text-forge-400 text-sm font-medium">
        Go to home
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient">FORGE</h1>
          <p className="text-gray-400 mt-2">Email verification</p>
        </div>
        <Suspense fallback={<div className="glass rounded-2xl p-8 text-center text-gray-400">Loading…</div>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
