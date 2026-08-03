'use client';

import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function VerifyEmailBanner() {
  const { user } = useAuth();

  const resend = useMutation({
    mutationFn: async () => {
      await api.post('/auth/verify-email/resend');
    },
  });

  if (!user || user.isVerified) return null;

  return (
    <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-on-surface">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-medium">Verify your email</span> to secure your account and get
          important updates.
        </p>
        <button
          type="button"
          disabled={resend.isPending}
          onClick={() => resend.mutate()}
          className="shrink-0 self-start rounded-lg bg-warning px-4 py-2 font-medium text-on-warning transition hover:opacity-90 disabled:opacity-50 sm:self-auto"
        >
          {resend.isPending ? 'Sending…' : 'Resend verification email'}
        </button>
      </div>
      {resend.isError && (
        <p className="mt-2 text-xs text-error">
          {(resend.error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || 'Could not send email. Try again later.'}
        </p>
      )}
      {resend.isSuccess && (
        <p className="mt-2 text-xs text-success">Check your inbox for the verification link.</p>
      )}
    </div>
  );
}
