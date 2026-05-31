'use client';

import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthScreen } from '@/components/auth/AuthScreen';

export function VerifyEmailPrompt({ welcome }: { welcome?: boolean }) {
  const { user, refresh, isGuest } = useAuth();

  const resend = useMutation({
    mutationFn: async () => {
      await api.post('/auth/verify-email/resend');
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

  if (user?.isVerified) {
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
          ? 'We sent a verification link. Confirm your email to unlock creator tools.'
          : 'Resend the link if you did not receive it.'
      }
    >
      <div className="space-y-4 text-center">
        <p className="text-sm text-on-surface-variant">
          Sent to <span className="font-medium text-on-surface">{user?.email}</span>
        </p>
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
