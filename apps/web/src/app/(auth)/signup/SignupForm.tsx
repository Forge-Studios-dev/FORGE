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
import { AuthSetupNotice } from '@/components/auth/AuthSetupNotice';
import { FirebaseSetupNotice } from '@/components/auth/FirebaseSetupNotice';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { LegalLinks } from '@/components/legal/LegalLinks';
import { isGoogleOAuthEnabled, loadPlatformConfig } from '@/lib/platform-config';
import type { PlatformPublicConfig } from '@forge/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const FIELDS = [
  { key: 'displayName', label: 'Display name', type: 'text', placeholder: 'Your name' },
  { key: 'username', label: 'Username', type: 'text', placeholder: 'your_handle' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'name@company.com' },
  { key: 'password', label: 'Password', type: 'password', placeholder: 'Min 8 characters' },
] as const;

export function SignupForm({
  nextPath,
  initialPlatformConfig = null,
  showGoogleInitially,
}: {
  nextPath: string;
  initialPlatformConfig?: PlatformPublicConfig | null;
  showGoogleInitially?: boolean;
}) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ email: '', username: '', displayName: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showGoogle, setShowGoogle] = useState(
    showGoogleInitially ??
      process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true',
  );
  const [platformConfig, setPlatformConfig] = useState<PlatformPublicConfig | null>(
    initialPlatformConfig ?? null,
  );

  useEffect(() => {
    void loadPlatformConfig().then((cfg) => {
      setPlatformConfig(cfg);
      setShowGoogle(isGoogleOAuthEnabled(cfg));
    });
  }, []);

  const loginHref =
    nextPath && nextPath !== '/'
      ? `/login?next=${encodeURIComponent(safeReturnPath(nextPath))}`
      : '/login';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const appCheck = await getAppCheckToken();
      const headers = appCheck ? { 'X-Firebase-AppCheck': appCheck } : undefined;
      const { data } = await api.post<{ data: AuthTokens }>(
        '/auth/signup',
        {
          ...form,
          email: form.email.trim().toLowerCase(),
          username: form.username.trim(),
          displayName: form.displayName.trim(),
          acceptedTerms: true,
        },
        { headers },
      );
      persistAuthSession(
        data.data.accessToken,
        data.data.refreshToken,
        JSON.stringify(data.data.user),
        data.data.sessionId,
      );
      void trackEvent('auth.signup', { method: 'password' });
      refresh();
      if (!data.data.user.isVerified) {
        router.push('/verify-email?welcome=1');
        return;
      }
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
      subtitle="Create an account to subscribe, comment, and save videos."
      showHeader={false}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {platformConfig && (
          <>
            <FirebaseSetupNotice config={platformConfig} />
            <AuthSetupNotice config={platformConfig} />
          </>
        )}
        {error && <p className="rounded-lg bg-error-container/30 px-4 py-2 text-sm text-error">{error}</p>}
        {FIELDS.map((field) => (
          <div key={field.key} className={field.key === 'password' ? 'space-y-2' : undefined}>
            <label className={authLabelClass} htmlFor={`signup-${field.key}`}>
              {field.label}
            </label>
            <input
              id={`signup-${field.key}`}
              type={field.type}
              required
              autoComplete={
                field.key === 'email'
                  ? 'email'
                  : field.key === 'password'
                    ? 'new-password'
                    : field.key === 'username'
                      ? 'username'
                      : 'name'
              }
              placeholder={field.placeholder}
              value={form[field.key]}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
              className={authFieldClass}
            />
            {field.key === 'password' && <PasswordStrengthMeter password={form.password} />}
          </div>
        ))}
        <label className="flex cursor-pointer items-start gap-3 text-sm text-on-surface-variant">
          <input
            type="checkbox"
            required
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-outline-variant accent-primary"
          />
          <span>
            I agree to the <LegalLinks />.
          </span>
        </label>
        <button
          type="submit"
          disabled={loading || !acceptedTerms}
          className="primary-button w-full rounded-full py-4 font-semibold text-on-primary disabled:opacity-60"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
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
      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Already have an account?{' '}
        <Link href={loginHref} className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
      <p className="mt-4 text-center text-xs text-outline">
        We send a verification link after sign up. Verify your email to unlock creator tools once approved.{' '}
        <LegalLinks />
      </p>
    </AuthScreen>
  );
}
