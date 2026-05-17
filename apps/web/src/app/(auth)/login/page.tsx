'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { persistAuthSession } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth';
import { AuthScreen, authFieldClass, authLabelClass } from '@/components/auth/AuthScreen';
import { AuthTokens } from '@/types';

function LoginForm() {
  const router = useRouter();
  const { refresh } = useAuth();
  const searchParams = useSearchParams();
  const resetOk = searchParams.get('reset') === '1';
  const nextPath = searchParams.get('next') || '/';
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<{ data: AuthTokens }>('/auth/login', form);
      persistAuthSession(
        data.data.accessToken,
        data.data.refreshToken,
        JSON.stringify(data.data.user),
      );
      refresh();
      if (data.data.user.role === 'admin') {
        const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3002';
        window.location.href = adminUrl;
        return;
      }
      if (data.data.user.role === 'creator' && data.data.user.creatorStatus && data.data.user.creatorStatus !== 'approved') {
        router.push(
          data.data.user.creatorStatus === 'rejected' ? '/approval-rejected' : '/waiting-approval',
        );
      } else {
        const safeNext = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';
        router.push(safeNext);
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen title="Welcome back" subtitle="Continue your path to mastery.">
      <form className="space-y-6" onSubmit={handleSubmit}>
        {resetOk && (
          <p className="rounded-lg bg-secondary/10 px-4 py-2 text-sm text-secondary">
            Password updated. Sign in with your new password.
          </p>
        )}
        {error && <p className="rounded-lg bg-error-container/30 px-4 py-2 text-sm text-error">{error}</p>}
        <div>
          <label className={authLabelClass} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={authFieldClass}
            placeholder="name@company.com"
          />
        </div>
        <div>
          <div className="mb-2 flex justify-between">
            <label className={authLabelClass} htmlFor="password">
              Password
            </label>
            <Link href="/forgot-password" className="font-label-caps text-xs text-secondary hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className={authFieldClass}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="primary-button w-full rounded-full py-4 font-semibold text-on-primary disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-8 text-center text-sm text-on-surface-variant">
        New to FORGE?{' '}
        <Link href="/signup" className="text-primary hover:underline">
          Create account
        </Link>
      </p>
    </AuthScreen>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-on-surface-variant">Loading…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
