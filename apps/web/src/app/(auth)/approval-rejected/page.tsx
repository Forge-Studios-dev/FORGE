'use client';

import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getAccessToken, getRefreshToken, persistAuthSession } from '@/lib/auth-storage';
import { User } from '@/types';
import { Icon } from '@forge/design-system';

export default function ApprovalRejectedPage() {
  const router = useRouter();
  const { user, refresh } = useAuth();

  const reRequest = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: User }>('/users/me/request-creator');
      return data.data;
    },
    onSuccess: (updatedUser) => {
      const access = getAccessToken();
      const refreshTok = getRefreshToken();
      if (access && refreshTok) {
        persistAuthSession(access, refreshTok, JSON.stringify(updatedUser));
      } else {
        localStorage.setItem('forge_user', JSON.stringify(updatedUser));
      }
      refresh();
      router.push('/waiting-approval');
    },
  });

  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-[10%] -top-[20%] h-[500px] w-[500px] rounded-full bg-error/10 blur-[120px]" />
      </div>
      <div className="glass-panel relative z-10 w-full max-w-lg rounded-2xl p-10">
        <Icon name="block" className="mb-6 text-5xl text-error" />
        <h1 className="font-display-forge mb-3 text-2xl font-bold">Creator request rejected</h1>
        <p className="mb-6 text-on-surface-variant">
          {user?.displayName ? `${user.displayName}, ` : ''}
          your creator request was not approved at this time.
        </p>

        {user?.creatorReviewNote ? (
          <div className="mb-6 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
            <p className="font-label-caps mb-1 text-outline">Reason</p>
            <p className="text-sm text-on-surface-variant">{user.creatorReviewNote}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reRequest.mutate()}
            disabled={reRequest.isPending}
            className="primary-button rounded-full px-6 py-2.5 font-semibold text-on-primary disabled:opacity-60"
          >
            {reRequest.isPending ? 'Submitting…' : 'Request again'}
          </button>
          <Link
            href="/"
            className="rounded-full border border-outline-variant px-6 py-2.5 font-semibold hover:border-primary"
          >
            Go to home
          </Link>
        </div>

        <p className="mt-6 text-xs text-outline">
          Update your profile and portfolio, then try again. Contact support if you need help.
        </p>
      </div>
    </main>
  );
}
