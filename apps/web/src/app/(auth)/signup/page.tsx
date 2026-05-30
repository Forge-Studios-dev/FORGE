'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { persistAuthSession } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth';
import { AuthScreen, authFieldClass } from '@/components/auth/AuthScreen';
import { AuthTokens } from '@/types';
import { safeReturnPath } from '@/lib/safe-return-path';

const FIELDS = [
  { key: 'displayName', label: 'Display name', type: 'text', placeholder: 'Your name' },
  { key: 'username', label: 'Username', type: 'text', placeholder: 'your_handle' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'name@company.com' },
  { key: 'password', label: 'Password', type: 'password', placeholder: 'Min 8 characters' },
] as const;

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';
  const { refresh } = useAuth();
  const [form, setForm] = useState({ email: '', username: '', displayName: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<{ data: AuthTokens }>('/auth/signup', {
        ...form,
        email: form.email.trim().toLowerCase(),
        username: form.username.trim(),
        displayName: form.displayName.trim(),
      });
      persistAuthSession(
        data.data.accessToken,
        data.data.refreshToken,
        JSON.stringify(data.data.user),
        data.data.sessionId,
      );
      refresh();
      if (data.data.user.role === 'creator' && data.data.user.creatorStatus && data.data.user.creatorStatus !== 'approved') {
        router.push(
          data.data.user.creatorStatus === 'rejected' ? '/approval-rejected' : '/waiting-approval',
        );
      } else {
        router.push(safeReturnPath(nextPath));
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Join FORGE"
      subtitle="Start your skill-first learning journey."
      showHeader={false}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {error && <p className="rounded-lg bg-error-container/30 px-4 py-2 text-sm text-error">{error}</p>}
        {FIELDS.map((field) => (
          <input
            key={field.key}
            type={field.type}
            required
            placeholder={field.placeholder}
            value={form[field.key]}
            onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
            className={authFieldClass}
          />
        ))}
        <button
          type="submit"
          disabled={loading}
          className="primary-button w-full rounded-full py-4 font-semibold text-on-primary disabled:opacity-60"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Already have an account?{' '}
        <Link
          href={
            nextPath && nextPath !== '/'
              ? `/login?next=${encodeURIComponent(safeReturnPath(nextPath))}`
              : '/login'
          }
          className="text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
      <p className="mt-4 text-center text-xs text-outline">
        We send a verification link after sign up. Verify your email to unlock creator tools once approved.
      </p>
    </AuthScreen>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-on-surface-variant">Loading…</div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
