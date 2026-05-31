'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthScreen, authFieldClass } from '@/components/auth/AuthScreen';
import { isEmailOtpVerificationEnabled, loadPlatformConfig } from '@/lib/platform-config';

export function VerifyEmailPrompt({ welcome }: { welcome?: boolean }) {
  const { user, refresh, isGuest } = useAuth();
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [email, setEmail] = useState(user?.email ?? '');
  const [code, setCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpOk, setOtpOk] = useState(false);

  useEffect(() => {
    setEmail(user?.email ?? '');
  }, [user?.email]);

  useEffect(() => {
    void loadPlatformConfig().then((cfg) => setOtpEnabled(isEmailOtpVerificationEnabled(cfg)));
  }, []);

  const resend = useMutation({
    mutationFn: async () => {
      await api.post('/auth/verify-email/resend');
    },
  });

  const verifyOtp = useMutation({
    mutationFn: async () => {
      await api.post('/auth/verify-email/otp', {
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });
    },
  });

  if (isGuest) {
    return (
      <AuthScreen title="Verify your email" subtitle="Sign in to resend your verification link.">
        <p className="text-center text-sm text-on-surface-variant">
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </AuthScreen>
    );
  }

  if (otpOk || user?.isVerified) {
    return (
      <AuthScreen title="Email verified" subtitle="Your account is ready.">
        <p className="text-center text-sm text-on-surface-variant">
          <Link href="/" className="text-primary hover:underline font-medium">
            Continue to FORGE
          </Link>
        </p>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title={welcome ? 'Check your inbox' : 'Verify your email'}
      subtitle={
        welcome
          ? otpEnabled
            ? 'We sent a verification link and a 6-digit code. Use either to confirm your email.'
            : 'We sent a verification link. Confirm your email to unlock creator tools.'
          : 'Resend the link if you did not receive it.'
      }
    >
      <div className="space-y-4 text-center">
        <p className="text-sm text-on-surface-variant">
          Sent to <span className="font-medium text-on-surface">{user?.email}</span>
        </p>
        {otpEnabled && (
          <div className="space-y-3 text-left">
            <p className="text-xs text-on-surface-variant text-center">
              Or enter the 6-digit code from your email
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authFieldClass}
              placeholder="Email"
              autoComplete="email"
            />
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={authFieldClass}
              placeholder="123456"
              autoComplete="one-time-code"
            />
            <button
              type="button"
              disabled={verifyOtp.isPending || code.length !== 6}
              onClick={() => {
                setOtpError('');
                verifyOtp.mutate(undefined, {
                  onSuccess: () => {
                    setOtpOk(true);
                    refresh();
                  },
                  onError: (err: unknown) => {
                    const m = (err as { response?: { data?: { message?: string } } })?.response
                      ?.data?.message;
                    setOtpError(typeof m === 'string' ? m : 'Invalid or expired code.');
                  },
                });
              }}
              className="primary-button w-full rounded-full py-4 font-semibold text-on-primary disabled:opacity-60"
            >
              {verifyOtp.isPending ? 'Verifying…' : 'Verify with code'}
            </button>
            {otpError && <p className="text-sm text-error text-center">{otpError}</p>}
          </div>
        )}
        <button
          type="button"
          disabled={resend.isPending}
          onClick={() => {
            resend.mutate(undefined, {
              onSuccess: () => refresh(),
            });
          }}
          className="primary-button w-full rounded-full py-4 font-semibold text-on-primary disabled:opacity-60"
        >
          {resend.isPending ? 'Sending…' : 'Resend verification email'}
        </button>
        {resend.isError && (
          <p className="text-sm text-error">Could not send email. Try again in a few minutes.</p>
        )}
        {resend.isSuccess && (
          <p className="text-sm text-secondary">Check your inbox and spam folder.</p>
        )}
        <Link href="/" className="inline-block text-sm text-primary hover:underline">
          Continue browsing
        </Link>
      </div>
    </AuthScreen>
  );
}
