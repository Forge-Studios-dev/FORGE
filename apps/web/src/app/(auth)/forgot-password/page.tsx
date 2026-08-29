'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AuthScreen, authFieldClass, authLabelClass } from '@/components/auth/AuthScreen';
import { Button } from '@forge/design-system';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setDone(true);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen title="Reset password" subtitle="We will email you a secure reset link.">
      {done ? (
        <div className="space-y-4 text-center">
          <p className="text-on-surface-variant">
            If an account exists for that email, we sent a reset link. Check your inbox and spam folder.
          </p>
          <Link href="/login" className="text-primary hover:underline text-sm font-medium">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && <p className="rounded-lg bg-error-container/30 px-4 py-2 text-sm text-error">{error}</p>}
          <div>
            <label className={authLabelClass} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authFieldClass}
              placeholder="name@company.com"
            />
          </div>
          <Button type="submit" variant="primary" disabled={loading} className="w-full py-4">
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
          <p className="text-center text-sm text-on-surface-variant">
            <Link href="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthScreen>
  );
}
