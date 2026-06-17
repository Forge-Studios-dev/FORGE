'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Subscription = {
  id: string;
  creatorId: string;
  status: string;
  tier?: { name: string };
  creator?: { username?: string; displayName?: string };
};

export default function MembershipsPage() {
  const { user, isGuest } = useAuth();

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['my-subscriptions', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await api.get<{ data: Subscription[] }>('/subscriptions/me');
      return data.data;
    },
  });

  if (isGuest) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8">
        <p className="text-sm text-on-surface-variant">
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>{' '}
          to view your memberships.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 md:px-12">
      <PageHeader title="My memberships" subtitle="Active creator memberships and subscriptions" />

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {(subscriptions ?? []).map((sub) => (
            <li key={sub.id} className="glass-panel rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {sub.creator?.displayName ?? sub.creator?.username ?? 'Creator'}
                  </p>
                  <p className="text-sm text-on-surface-variant">{sub.tier?.name ?? 'Member'}</p>
                </div>
                <span className="text-xs capitalize text-primary">{sub.status}</span>
              </div>
              {sub.creator?.username ? (
                <Link
                  href={`/${sub.creator.username}/community`}
                  className="mt-2 inline-block text-xs text-primary hover:underline"
                >
                  Open community →
                </Link>
              ) : null}
            </li>
          ))}
          {(subscriptions ?? []).length === 0 ? (
            <p className="text-sm text-on-surface-variant">No active memberships yet.</p>
          ) : null}
        </ul>
      )}

      <Link href="/profile/settings" className="mt-8 inline-block text-sm text-primary hover:underline">
        ← Back to settings
      </Link>
    </main>
  );
}
