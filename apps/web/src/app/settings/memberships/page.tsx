'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-message';
import { useAuth } from '@/lib/auth';

type Subscription = {
  id: string;
  creatorId: string;
  tierId?: string;
  status: string;
  source?: string;
  tier?: { id: string; name: string };
  creator?: { username?: string; displayName?: string };
};

type CreatorTier = {
  id: string;
  name: string;
  priceCents: number;
};

type TierChangeResult = {
  checkoutUrl?: string | null;
  changed?: boolean;
  prorationApplied?: boolean;
};

function TierChangeSelect({
  subscription,
  onChanged,
}: {
  subscription: Subscription;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const { data: tiers } = useQuery({
    queryKey: ['creator-tiers', subscription.creatorId],
    queryFn: async () => {
      const { data } = await api.get<{ data: CreatorTier[] }>(
        `/creators/${subscription.creatorId}/tiers`,
      );
      return data.data;
    },
  });

  const changeMutation = useMutation({
    mutationFn: async (tierId: string) => {
      const { data } = await api.post<{ data: TierChangeResult }>(
        '/billing/subscriptions/change-tier',
        { creatorId: subscription.creatorId, tierId },
      );
      return data.data;
    },
    onSuccess: (result) => {
      // The backend either applies an immediate (prorated) tier change or, when a
      // new checkout is required, returns a hosted checkout URL — follow it.
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      onChanged();
    },
    onError: (err) =>
      setError(getApiErrorMessage(err, 'Could not change your tier. Please try again.')),
  });

  const currentTier = (tiers ?? []).find((t) => t.id === subscription.tierId);
  const otherTiers = (tiers ?? [])
    .filter((t) => t.id !== subscription.tierId)
    .sort((a, b) => a.priceCents - b.priceCents);
  if (otherTiers.length === 0) return null;

  const optionLabel = (t: CreatorTier) => {
    const price = `$${(t.priceCents / 100).toFixed(2)}/mo`;
    if (!currentTier || t.priceCents === currentTier.priceCents) {
      return `Switch to ${t.name} (${price})`;
    }
    const direction = t.priceCents > currentTier.priceCents ? 'Upgrade' : 'Downgrade';
    return `${direction} to ${t.name} (${price})`;
  };

  return (
    <label className="mt-2 block text-xs">
      <span className="text-on-surface-variant">Change tier</span>
      <select
        className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface-container-high px-2 py-1.5 text-sm disabled:opacity-60"
        defaultValue=""
        disabled={changeMutation.isPending}
        onChange={(e) => {
          const tierId = e.target.value;
          if (!tierId) return;
          const target = otherTiers.find((t) => t.id === tierId);
          const isUpgrade = !!currentTier && !!target && target.priceCents > currentTier.priceCents;
          const message = isUpgrade
            ? 'Upgrade now? Your card is charged a prorated amount immediately and access updates right away.'
            : 'Change your tier? Billing is adjusted on your subscription and access updates accordingly.';
          if (window.confirm(message)) {
            setError(null);
            changeMutation.mutate(tierId);
          }
          e.target.value = '';
        }}
      >
        <option value="">
          {changeMutation.isPending ? 'Updating…' : 'Select new tier…'}
        </option>
        {otherTiers.map((t) => (
          <option key={t.id} value={t.id}>
            {optionLabel(t)}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-error">{error}</p> : null}
    </label>
  );
}

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
    mutationFn: async ({
      creatorId,
      cancelAtPeriodEnd,
    }: {
      creatorId: string;
      cancelAtPeriodEnd?: boolean;
    }) => {
      const qs = cancelAtPeriodEnd ? '?cancelAtPeriodEnd=true' : '';
      await api.delete(`/subscriptions/me/${creatorId}${qs}`);
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

  const useStripe = process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true';

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
            const isRenewalPending = sub.status === 'renewal_pending';
            const canManage =
              sub.status === 'active' ||
              sub.status === 'trial' ||
              sub.status === 'grace_period' ||
              isRenewalPending;
            const canCancelNow =
              canManage &&
              !isRenewalPending &&
              (sub.source !== 'stripe' || !useStripe);
            const canCancelAtPeriodEnd =
              canManage && !isRenewalPending && sub.source === 'stripe' && useStripe;
            return (
              <li key={sub.id} className="glass-panel rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {sub.creator?.displayName ?? sub.creator?.username ?? 'Creator'}
                    </p>
                    <p className="text-sm text-on-surface-variant">{sub.tier?.name ?? 'Member'}</p>
                    {isRenewalPending ? (
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Cancels at end of billing period — access remains until then.
                      </p>
                    ) : null}
                  </div>
                  <span className="text-xs capitalize text-primary">{sub.status.replace('_', ' ')}</span>
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
                  {canCancelAtPeriodEnd ? (
                    <Button
                      variant="ghost"
                      className="h-auto px-0 py-0 text-xs text-on-surface-variant"
                      disabled={cancelMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Cancel at the end of your billing period? You keep access until then.',
                          )
                        ) {
                          cancelMutation.mutate({ creatorId: sub.creatorId, cancelAtPeriodEnd: true });
                        }
                      }}
                    >
                      Cancel at period end
                    </Button>
                  ) : null}
                  {canCancelNow || (canManage && !isRenewalPending && sub.source === 'stripe' && useStripe) ? (
                    <Button
                      variant="ghost"
                      className="h-auto px-0 py-0 text-xs text-error"
                      disabled={cancelMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Cancel this membership immediately? You may lose access to member-only content.',
                          )
                        ) {
                          cancelMutation.mutate({ creatorId: sub.creatorId });
                        }
                      }}
                    >
                      Cancel now
                    </Button>
                  ) : null}
                  {!canCancelNow && !canCancelAtPeriodEnd && canManage && !isRenewalPending ? (
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
                          cancelMutation.mutate({ creatorId: sub.creatorId });
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
                {canManage && !isRenewalPending ? (
                  <TierChangeSelect
                    subscription={sub}
                    onChanged={() => {
                      void qc.invalidateQueries({ queryKey: ['my-subscriptions', user?.id] });
                    }}
                  />
                ) : null}
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
