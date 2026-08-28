'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { AuthScreen, authFieldClass, authLabelClass } from '@/components/auth/AuthScreen';
import { Button } from '@forge/design-system';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (token.length < 32) {
      setError('Invalid or missing reset token. Open the link from your email.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      router.push('/login?reset=1');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const text = Array.isArray(message) ? message.join(', ') : message;
      setError(text || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-on-surface-variant">Missing reset token. Use the link from your email.</p>
        <Link href="/forgot-password" className="text-primary hover:underline text-sm font-medium">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && <p className="rounded-lg bg-error-container/30 px-4 py-2 text-sm text-error">{error}</p>}
      <div>
        <label className={authLabelClass} htmlFor="password">
          New password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={authFieldClass}
          placeholder="8+ chars, upper, lower, number"
        />
        <p className="mt-2 text-xs text-outline">Must include uppercase, lowercase, and a number.</p>
      </div>
      <Button type="submit" variant="primary" disabled={loading} className="w-full py-4">
        {loading ? 'Updating…' : 'Update password'}
      </Button>
      <p className="text-center text-sm text-on-surface-variant">
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthScreen title="New password" subtitle="Choose a strong password for your account.">
      <Suspense fallback={<p className="text-center text-on-surface-variant">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthScreen>
  );
}
