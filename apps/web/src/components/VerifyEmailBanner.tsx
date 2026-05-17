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
    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p>
          <span className="font-medium">Verify your email</span> to secure your account and get important updates.
        </p>
        <button
          type="button"
          disabled={resend.isPending}
          onClick={() => resend.mutate()}
          className="shrink-0 self-start sm:self-auto bg-amber-600/80 hover:bg-amber-500 text-white font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          {resend.isPending ? 'Sending…' : 'Resend verification email'}
        </button>
      </div>
      {resend.isError && <p className="text-red-300 text-xs mt-2">Could not send email. Try again later.</p>}
      {resend.isSuccess && <p className="text-emerald-300 text-xs mt-2">Check your inbox for the verification link.</p>}
    </div>
  );
}
