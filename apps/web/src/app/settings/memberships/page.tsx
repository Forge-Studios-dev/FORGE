'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, EmptyState, PageHeader } from '@forge/design-system';
import { ConfirmDialog } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-message';
import { trackEvent } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { env } from '@/env';

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
  const [pendingTierId, setPendingTierId] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState('');

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
      setPendingTierId(null);
      // The backend either applies an immediate (prorated) tier change or, when a
      // new checkout is required, returns a hosted checkout URL — follow it.
      if (result?.checkoutUrl) {
        void trackEvent('billing.checkout_started', { creatorId: subscription.creatorId });
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
    <div className="mt-2 text-xs">
      <label className="block">
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
            setPendingMessage(
              isUpgrade
                ? 'Upgrade now? Your card is charged a prorated amount immediately and access updates right away.'
                : 'Change your tier? Billing is adjusted on your subscription and access updates accordingly.',
            );
            setPendingTierId(tierId);
            setError(null);
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
      </label>
      {error ? <p className="mt-1 text-xs text-error">{error}</p> : null}
      <ConfirmDialog
        open={!!pendingTierId}
        title="Change membership tier?"
        description={pendingMessage}
        confirmLabel="Confirm"
        variant="primary"
        onConfirm={() => {
          if (pendingTierId) changeMutation.mutate(pendingTierId);
        }}
        onCancel={() => setPendingTierId(null)}
        loading={changeMutation.isPending}
      />
    </div>
  );
}

type CancelConfirm =
  | { creatorId: string; mode: 'period_end' | 'now' | 'generic' }
  | null;

export default function MembershipsPage() {
  const { user, isGuest } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cancelConfirm, setCancelConfirm] = useState<CancelConfirm>(null);

  useEffect(() => {
    if (searchParams.get('billing_return') !== '1') return;
    void trackEvent('billing.checkout_returned', {});
    // Strip the marker so a page refresh doesn't re-fire the event.
    router.replace('/settings/memberships');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on the return redirect only
  }, []);

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
    onSuccess: (_data, variables) => {
      setCancelConfirm(null);
      void trackEvent('billing.subscription_canceled', {
        creatorId: variables.creatorId,
        cancelAtPeriodEnd: !!variables.cancelAtPeriodEnd,
      });
      void qc.invalidateQueries({ queryKey: ['my-subscriptions', user?.id] });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const returnUrl = `${window.location.origin}/settings/memberships?billing_return=1`;
      const { data } = await api.post<{ data: { url: string } }>('/billing/portal', {
        returnUrl,
      });
      if (data.data?.url) window.location.href = data.data.url;
    },
  });

  const useStripe = env.NEXT_PUBLIC_BILLING_ENABLED === 'true';

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

  const cancelCopy =
    cancelConfirm?.mode === 'period_end'
      ? {
          title: 'Cancel at period end?',
          description: 'You keep access until the end of your billing period.',
          confirmLabel: 'Cancel at period end',
        }
      : cancelConfirm?.mode === 'now'
        ? {
            title: 'Cancel membership now?',
            description: 'You may lose access to member-only content immediately.',
            confirmLabel: 'Cancel now',
          }
        : {
            title: 'Cancel membership?',
            description: 'You may lose access to member-only content.',
            confirmLabel: 'Cancel membership',
          };

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 md:px-12">
      <PageHeader title="My memberships" subtitle="Active creator memberships and subscriptions" />

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : (subscriptions ?? []).length === 0 ? (
        <EmptyState
          icon="workspace_premium"
          title="No active memberships yet"
          description="Join a channel membership to support creators and unlock perks."
          action={{ label: 'Discover creators', href: '/explore' }}
        />
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
                      onClick={() =>
                        setCancelConfirm({ creatorId: sub.creatorId, mode: 'period_end' })
                      }
                    >
                      Cancel at period end
                    </Button>
                  ) : null}
                  {canCancelNow || (canManage && !isRenewalPending && sub.source === 'stripe' && useStripe) ? (
                    <Button
                      variant="ghost"
                      className="h-auto px-0 py-0 text-xs text-error"
                      disabled={cancelMutation.isPending}
                      onClick={() => setCancelConfirm({ creatorId: sub.creatorId, mode: 'now' })}
                    >
                      Cancel now
                    </Button>
                  ) : null}
                  {!canCancelNow && !canCancelAtPeriodEnd && canManage && !isRenewalPending ? (
                    <Button
                      variant="ghost"
                      className="h-auto px-0 py-0 text-xs text-error"
                      disabled={cancelMutation.isPending}
                      onClick={() =>
                        setCancelConfirm({ creatorId: sub.creatorId, mode: 'generic' })
                      }
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
        </ul>
      )}

      <ConfirmDialog
        open={!!cancelConfirm}
        title={cancelCopy.title}
        description={cancelCopy.description}
        confirmLabel={cancelCopy.confirmLabel}
        onConfirm={() => {
          if (!cancelConfirm) return;
          cancelMutation.mutate({
            creatorId: cancelConfirm.creatorId,
            cancelAtPeriodEnd: cancelConfirm.mode === 'period_end',
          });
        }}
        onCancel={() => setCancelConfirm(null)}
        loading={cancelMutation.isPending}
      />

      <Link href="/profile/settings" className="mt-8 inline-block text-sm text-primary hover:underline">
        ← Back to settings
      </Link>
    </main>
  );
}
