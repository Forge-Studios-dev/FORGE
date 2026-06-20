'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button, PageHeader } from '@forge/design-system';
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
  const qc = useQueryClient();

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['my-subscriptions', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await api.get<{ data: Subscription[] }>('/subscriptions/me');
      return data.data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (creatorId: string) => {
      await api.delete(`/subscriptions/me/${creatorId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-subscriptions', user?.id] });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const returnUrl = `${window.location.origin}/settings/memberships`;
      const { data } = await api.post<{ data: { url: string } }>('/billing/portal', {
        returnUrl,
      });
      if (data.data?.url) window.location.href = data.data.url;
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
          {(subscriptions ?? []).map((sub) => {
            const canCancel = sub.status === 'active' || sub.status === 'trial' || sub.status === 'grace_period';
            return (
              <li key={sub.id} className="glass-panel rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {sub.creator?.displayName ?? sub.creator?.username ?? 'Creator'}
                    </p>
                    <p className="text-sm text-on-surface-variant">{sub.tier?.name ?? 'Member'}</p>
                  </div>
                  <span className="text-xs capitalize text-primary">{sub.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {sub.creator?.username ? (
                    <Link
                      href={`/${sub.creator.username}/community`}
                      className="text-xs text-primary hover:underline"
                    >
                      Open community →
                    </Link>
                  ) : null}
                  {canCancel ? (
                    <Button
                      variant="ghost"
                      className="h-auto px-0 py-0 text-xs text-error"
                      disabled={cancelMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Cancel this membership? You may lose access to member-only content.',
                          )
                        ) {
                          cancelMutation.mutate(sub.creatorId);
                        }
                      }}
                    >
                      Cancel membership
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    className="h-auto px-0 py-0 text-xs text-primary"
                    disabled={portalMutation.isPending}
                    onClick={() => portalMutation.mutate()}
                  >
                    Manage billing
                  </Button>
                </div>
              </li>
            );
          })}
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
