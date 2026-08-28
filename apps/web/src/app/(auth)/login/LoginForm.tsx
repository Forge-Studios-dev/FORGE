'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { persistAuthSession } from '@/lib/auth-storage';
import { trackEvent } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { AuthScreen, authFieldClass, authLabelClass } from '@/components/auth/AuthScreen';
import { AuthTokens } from '@/types';
import { safeReturnPath } from '@/lib/safe-return-path';
import { getAppCheckToken } from '@/lib/app-check';
import { GoogleOAuthSetupNotice } from '@/components/auth/GoogleOAuthSetupNotice';
import { isGoogleOAuthEnabled, loadPlatformConfig } from '@/lib/platform-config';
import type { PlatformPublicConfig } from '@forge/shared-types';
import { LegalLinks } from '@/components/legal/LegalLinks';
import { Button } from '@forge/design-system';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export function LoginForm({
  nextPath,
  resetOk,
  adminBlocked,
  initialPlatformConfig = null,
  showGoogleInitially,
}: {
  nextPath: string;
  resetOk: boolean;
  adminBlocked: boolean;
  initialPlatformConfig?: PlatformPublicConfig | null;
  showGoogleInitially?: boolean;
}) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showGoogle, setShowGoogle] = useState(
    showGoogleInitially ??
      process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true',
  );
  const [platformConfig, setPlatformConfig] = useState<PlatformPublicConfig | null>(
    initialPlatformConfig ?? null,
  );
  const [mfaChallengeToken, setMfaChallengeToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaPending, setMfaPending] = useState(false);

  useEffect(() => {
    void loadPlatformConfig().then((cfg) => {
      setPlatformConfig(cfg);
      setShowGoogle(isGoogleOAuthEnabled(cfg));
    });
  }, []);

  // Google OAuth login for an MFA-enrolled account redirects here with the
  // challenge token in a hash fragment (never a query param, so it never
  // hits server logs / Referer headers) instead of completing sign-in.
  useEffect(() => {
    const hash = window.location.hash;
    const match = /(?:^#|&)mfaChallengeToken=([^&]+)/.exec(hash);
    if (!match) return;
    setMfaChallengeToken(decodeURIComponent(match[1]));
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  const completeLogin = (tokens: AuthTokens, method: 'password' | 'mfa') => {
    persistAuthSession(
      tokens.accessToken,
      tokens.refreshToken,
      JSON.stringify(tokens.user),
      tokens.sessionId,
    );
    void trackEvent('auth.login', { method });
    refresh();
    if (
      tokens.user.role === 'creator' &&
      tokens.user.creatorStatus &&
      tokens.user.creatorStatus !== 'approved'
    ) {
      router.push(
        tokens.user.creatorStatus === 'rejected' ? '/approval-rejected' : '/waiting-approval',
      );
    } else {
      router.push(safeReturnPath(nextPath));
    }
  };

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
      const { data } = await api.post<{ data: AuthTokens | { mfaRequired: true; challengeToken: string } }>(
        '/auth/login',
        payload,
        { headers },
      );
      if ('mfaRequired' in data.data) {
        setMfaChallengeToken(data.data.challengeToken);
        return;
      }
      if (data.data.user.role === 'admin') {
        setError(
          'Platform administrator accounts cannot sign in here. Use the dedicated admin application.',
        );
        return;
      }
      completeLogin(data.data, 'password');
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

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMfaPending(true);
    try {
      const { data } = await api.post<{ data: AuthTokens }>('/auth/mfa/login-verify', {
        challengeToken: mfaChallengeToken,
        code: mfaCode.trim(),
      });
      completeLogin(data.data, 'mfa');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(message || 'Invalid or expired code. Try again.');
    } finally {
      setMfaPending(false);
    }
  };

  const signupHref =
    nextPath && nextPath !== '/'
      ? `/signup?next=${encodeURIComponent(safeReturnPath(nextPath))}`
      : '/signup';

  if (mfaChallengeToken) {
    return (
      <AuthScreen
        title="Two-factor verification"
        subtitle="Enter the 6-digit code from your authenticator app, or a backup code."
      >
        <form className="space-y-6" onSubmit={handleMfaSubmit}>
          {error && (
            <p className="rounded-lg bg-error-container/30 px-4 py-2 text-sm text-error">{error}</p>
          )}
          <div>
            <label className={authLabelClass} htmlFor="mfa-code">
              Verification code
            </label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              className={authFieldClass}
              placeholder="123456"
            />
          </div>
          <Button type="submit" variant="primary" disabled={mfaPending} className="w-full py-4">
            {mfaPending ? 'Verifying…' : 'Verify'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setMfaChallengeToken('');
              setMfaCode('');
              setError('');
            }}
            className="w-full text-center text-sm text-on-surface-variant hover:underline"
          >
            Back to login
          </button>
        </form>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Welcome back" subtitle="Sign in to subscribe, comment, and save videos.">
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
        <Button type="submit" variant="primary" disabled={loading} className="w-full py-4">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
        {showGoogle && (
          <a
            href={`${API_URL}/auth/google`}
            onClick={() => {
              try {
                sessionStorage.setItem('forge_oauth_next', nextPath || '/');
              } catch {
                /* ignore */
              }
            }}
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
      <p className="mt-4 text-center text-xs text-outline">
        <LegalLinks />
      </p>
    </AuthScreen>
  );
}
