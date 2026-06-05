'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  isMockSubscriptionsEnabled,
  isStripeBillingEnabled,
  loadPlatformConfig,
} from '@/lib/platform-config';
import { SubscriptionTier } from '@/types';

interface Props {
  creatorId: string;
}

export function MembershipPanel({ creatorId }: Props) {
  const { user, isGuest } = useAuth();
  const qc = useQueryClient();

  const { data: platformConfig } = useQuery({
    queryKey: ['platform-config'],
    queryFn: loadPlatformConfig,
    staleTime: 5 * 60_000,
  });

  const stripeEnabled = platformConfig ? isStripeBillingEnabled(platformConfig) : false;
  const mockEnabled = platformConfig ? isMockSubscriptionsEnabled(platformConfig) : true;

  const { data: tiers } = useQuery({
    queryKey: ['tiers', creatorId],
    queryFn: async () => {
      const { data } = await api.get<{ data: SubscriptionTier[] }>(`/creators/${creatorId}/tiers`);
      return data.data;
    },
  });

  const { data: membership } = useQuery({
    queryKey: ['membership', creatorId, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          active: boolean;
          isTestMembership?: boolean;
          subscription?: { tier?: { name: string }; source?: string };
        };
      }>(`/creators/${creatorId}/membership/me`);
      return data.data;
    },
  });

  const mockMutation = useMutation({
    mutationFn: async (tierId: string) => {
      await api.post('/subscriptions/mock', { creatorId, tierId });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['membership', creatorId] });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (tierId: string) => {
      const { data } = await api.post<{
        data: { checkoutUrl: string | null };
      }>('/billing/checkout', { creatorId, tierId });
      return data.data;
    },
    onSuccess: (result) => {
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await api.post('/billing/subscriptions/cancel', { creatorId });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['membership', creatorId] });
    },
  });

  const isPaidMember =
    membership?.active && membership.subscription?.source === 'payment';

  if (membership?.active) {
    return (
      <div className="glass-panel space-y-3 rounded-xl p-4 text-sm">
        <div>
          <span className="font-medium text-primary">
            {membership.subscription?.tier?.name ?? 'Member'}
          </span>
          {membership.isTestMembership ? (
            <span className="ml-2 rounded-full bg-tertiary/20 px-2 py-0.5 text-xs text-tertiary">
              Test membership
            </span>
          ) : isPaidMember ? (
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
              Paid member
            </span>
          ) : null}
        </div>
        {isPaidMember && stripeEnabled ? (
          <button
            type="button"
            disabled={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
            className="text-xs text-on-surface-variant underline hover:text-error disabled:opacity-40"
          >
            {cancelMutation.isPending ? 'Canceling…' : 'Cancel subscription'}
          </button>
        ) : null}
      </div>
    );
  }

  if (isGuest || !tiers?.length) return null;

  const canCheckout = (tier: SubscriptionTier) =>
    stripeEnabled && tier.priceCents > 0 && tier.hasStripePrice;

  const canMockJoin = (tier: SubscriptionTier) =>
    mockEnabled && (!stripeEnabled || tier.priceCents <= 0 || !tier.hasStripePrice);

  return (
    <div className="glass-panel space-y-3 rounded-xl p-4">
      <p className="text-sm font-medium">Become a member</p>
      <ul className="space-y-2">
        {tiers.map((tier) => (
          <li key={tier.id} className="flex items-center justify-between text-sm">
            <span>
              {tier.name} — {tier.currency} {(tier.priceCents / 100).toFixed(0)}/mo
            </span>
            {canCheckout(tier) ? (
              <button
                type="button"
                disabled={checkoutMutation.isPending}
                onClick={() => checkoutMutation.mutate(tier.id)}
                className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-on-primary disabled:opacity-40"
              >
                {checkoutMutation.isPending ? 'Redirecting…' : 'Subscribe'}
              </button>
            ) : canMockJoin(tier) ? (
              <button
                type="button"
                disabled={mockMutation.isPending}
                onClick={() => mockMutation.mutate(tier.id)}
                className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-on-primary disabled:opacity-40"
              >
                Join (test)
              </button>
            ) : (
              <span className="text-xs text-on-surface-variant">Unavailable</span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-on-surface-variant">
        {stripeEnabled
          ? 'Paid tiers use Stripe Checkout. Free or unconfigured tiers may use test membership in dev.'
          : 'Test memberships only — enable Stripe on the API for real billing.'}
      </p>
    </div>
  );
}
