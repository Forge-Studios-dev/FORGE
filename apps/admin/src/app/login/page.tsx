'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { persistAdminSession } from '@/lib/auth-storage';
import { getAppCheckToken } from '@/lib/app-check';

type LoginOk = { accessToken: string; refreshToken: string; user: { role: string } };
type LoginMfa = { mfaRequired: true; challengeToken: string };

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [mfaChallengeToken, setMfaChallengeToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaPending, setMfaPending] = useState(false);

  const finishAdminSession = (session: LoginOk) => {
    if (session.user.role !== 'admin') {
      router.push('/unauthorized');
      return;
    }
    persistAdminSession(session.accessToken);
    const next = searchParams.get('next');
    router.push(next && next.startsWith('/') ? next : '/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim() || !form.email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const appCheck = await getAppCheckToken();
      const headers: Record<string, string> = {};
      if (appCheck) headers['X-Firebase-AppCheck'] = appCheck;

      const { data } = await api.post<{ data: LoginOk | LoginMfa }>('/auth/login', form, {
        headers,
      });
      if ('mfaRequired' in data.data && data.data.mfaRequired) {
        setMfaChallengeToken(data.data.challengeToken);
        return;
      }
      finishAdminSession(data.data as LoginOk);
    } catch {
      setError('Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMfaPending(true);
    try {
      const { data } = await api.post<{ data: LoginOk }>('/auth/mfa/login-verify', {
        challengeToken: mfaChallengeToken,
        code: mfaCode.trim(),
      });
      finishAdminSession(data.data);
    } catch {
      setError('Invalid or expired code. Try again.');
    } finally {
      setMfaPending(false);
    }
  };

  if (mfaChallengeToken) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md">
          <PageHeader
            title="Two-factor verification"
            subtitle="Enter the 6-digit code from your authenticator app, or a backup code."
          />
          <form onSubmit={(e) => void handleMfaSubmit(e)} className="glass-panel space-y-5 rounded-2xl p-8">
            {error ? <p className="text-sm text-error">{error}</p> : null}
            <div>
              <label className="font-label-caps mb-2 block text-outline" htmlFor="admin-mfa-code">
                Authentication code
              </label>
              <Input
                id="admin-mfa-code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                autoComplete="one-time-code"
                inputMode="numeric"
                required
              />
            </div>
            <Button type="submit" disabled={mfaPending || mfaCode.trim().length < 6} className="w-full">
              {mfaPending ? 'Verifying…' : 'Verify'}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-on-surface-variant hover:underline"
              onClick={() => {
                setMfaChallengeToken('');
                setMfaCode('');
                setError('');
              }}
            >
              Back to sign in
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <PageHeader title="FORGE Admin" subtitle="Sign in to manage the platform" />
        <form onSubmit={(e) => void handleSubmit(e)} className="glass-panel space-y-5 rounded-2xl p-8">
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <div>
            <label className="font-label-caps mb-2 block text-outline">Email</label>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="font-label-caps mb-2 block text-outline">Password</label>
            <Input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-on-surface-variant">
          Loading…
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
