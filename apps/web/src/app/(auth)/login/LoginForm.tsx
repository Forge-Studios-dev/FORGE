'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { persistAuthSession } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth';
import { AuthScreen, authFieldClass, authLabelClass } from '@/components/auth/AuthScreen';
import { AuthTokens } from '@/types';
import { safeReturnPath } from '@/lib/safe-return-path';
import { getAppCheckToken } from '@/lib/app-check';
import { GoogleOAuthSetupNotice } from '@/components/auth/GoogleOAuthSetupNotice';
import { isGoogleOAuthEnabled, loadPlatformConfig } from '@/lib/platform-config';
import type { PlatformPublicConfig } from '@forge/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export function LoginForm({
  nextPath,
  resetOk,
  adminBlocked,
}: {
  nextPath: string;
  resetOk: boolean;
  adminBlocked: boolean;
}) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showGoogle, setShowGoogle] = useState(
    process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true',
  );
  const [platformConfig, setPlatformConfig] = useState<PlatformPublicConfig | null>(null);

  useEffect(() => {
    void loadPlatformConfig().then((cfg) => {
      setPlatformConfig(cfg);
      setShowGoogle(isGoogleOAuthEnabled(cfg));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
      };
      const appCheck = await getAppCheckToken();
      const headers = appCheck ? { 'X-Firebase-AppCheck': appCheck } : undefined;
      const { data } = await api.post<{ data: AuthTokens }>('/auth/login', payload, { headers });
      if (data.data.user.role === 'admin') {
        setError(
          'Platform administrator accounts cannot sign in here. Use the dedicated admin application.',
        );
        return;
      }
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
      const data = (err as { response?: { data?: { message?: string; code?: string } } })?.response
        ?.data;
      if (data?.code === 'EMAIL_NOT_VERIFIED') {
        router.push('/verify-email');
        return;
      }
      if (data?.code === 'USE_GOOGLE_SIGNIN') {
        setError('This account uses Google. Use Continue with Google below.');
        return;
      }
      if (data?.code === 'ACCOUNT_LOCKED') {
        setError(
          data?.message ||
            'Too many failed attempts. Try again later or reset your password.',
        );
        return;
      }
      if (data?.code === 'ACCOUNT_DISABLED') {
        setError(data?.message || 'This account has been disabled.');
        return;
      }
      setError(data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const signupHref =
    nextPath && nextPath !== '/'
      ? `/signup?next=${encodeURIComponent(safeReturnPath(nextPath))}`
      : '/signup';

  return (
    <AuthScreen title="Welcome back" subtitle="Continue your path to mastery.">
      <form className="space-y-6" onSubmit={handleSubmit}>
        {resetOk && (
          <p className="rounded-lg bg-secondary/10 px-4 py-2 text-sm text-secondary">
            Password updated. Sign in with your new password.
          </p>
        )}
        {adminBlocked && (
          <p className="rounded-lg bg-error-container/30 px-4 py-2 text-sm text-error">
            Platform administrator accounts cannot use the public site. Sign in on the admin application.
          </p>
        )}
        {platformConfig && <GoogleOAuthSetupNotice config={platformConfig} />}
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
        {showGoogle && (
          <a
            href={`${API_URL}/auth/google`}
            className="mt-3 block w-full rounded-full border border-outline py-4 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Continue with Google
          </a>
        )}
      </form>
      <p className="mt-8 text-center text-sm text-on-surface-variant">
        New to FORGE?{' '}
        <Link href={signupHref} className="text-primary hover:underline">
          Create account
        </Link>
      </p>
    </AuthScreen>
  );
}
