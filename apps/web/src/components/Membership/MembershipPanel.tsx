'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SubscriptionTier } from '@/types';

interface Props {
  creatorId: string;
  /** When set, checkout creates a community-scoped subscription. */
  communityId?: string;
  /** Tier that unlocks the content the viewer just hit a paywall on — sorted first, badged. */
  highlightTierId?: string | null;
}

type ProductBundle = {
  id: string;
  name: string;
  description?: string | null;
  tierId: string;
  items: Array<{ resourceType: string; resourceId?: string | null }>;
  tier?: { name: string; priceCents: number; currency: string; billingInterval: string };
};

export function MembershipPanel({ creatorId, communityId, highlightTierId }: Props) {
  const { user, isGuest } = useAuth();
  const qc = useQueryClient();

  const { data: tiers } = useQuery({
    queryKey: ['tiers', creatorId],
    queryFn: async () => {
      const { data } = await api.get<{ data: SubscriptionTier[] }>(`/creators/${creatorId}/tiers`);
      return data.data;
    },
  });

  const { data: bundles } = useQuery({
    queryKey: ['bundles', creatorId],
    queryFn: async () => {
      const { data } = await api.get<{ data: ProductBundle[] }>(`/creators/${creatorId}/bundles`);
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
          subscription?: { tier?: { name: string } };
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
      void qc.invalidateQueries({ queryKey: ['community', creatorId] });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (tierId: string) => {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { data } = await api.post<{ data: { checkoutUrl?: string | null } }>('/billing/checkout', {
        creatorId,
        tierId,
        ...(communityId ? { communityId } : {}),
        successUrl: `${origin}/settings/memberships?success=1`,
        cancelUrl: `${origin}${window.location.pathname}`,
      });
      const url = data.data.checkoutUrl;
      if (url) window.location.href = url;
    },
  });

  if (membership?.active) {
    return (
      <div className="glass-panel rounded-xl p-4 text-sm">
        <span className="font-medium text-primary">
          {membership.subscription?.tier?.name ?? 'Member'}
        </span>
        {membership.isTestMembership ? (
          <StatusPill tone="reward" label="Test membership" className="ml-2" />
        ) : null}
      </div>
    );
  }

  if (isGuest || !tiers?.length) return null;

  const useStripe = process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true';
  const sortedTiers = highlightTierId
    ? [...tiers].sort((a, b) =>
        a.id === highlightTierId ? -1 : b.id === highlightTierId ? 1 : 0,
      )
    : tiers;

  return (
    <div className="glass-panel w-full max-w-md space-y-3 rounded-xl p-4">
      <p className="text-sm font-medium">Become a member</p>
      <ul className="space-y-2">
        {sortedTiers.map((tier) => (
          <li
            key={tier.id}
            className={`flex items-center justify-between rounded-lg text-sm ${
              tier.id === highlightTierId ? 'border border-primary/40 bg-primary/5 p-2' : ''
            }`}
          >
            <span>
              {tier.name} — {tier.currency} {(tier.priceCents / 100).toFixed(0)}/mo
              {tier.id === highlightTierId ? (
                <StatusPill tone="primary" label="Unlocks this lesson" className="ml-2" />
              ) : null}
            </span>
            {useStripe ? (
              <Button
                variant="primary"
                className="px-3 py-1 text-xs"
                disabled={checkoutMutation.isPending}
                onClick={() => checkoutMutation.mutate(tier.id)}
              >
                Subscribe
              </Button>
            ) : (
              <Button
                variant="primary"
                className="px-3 py-1 text-xs"
                disabled={mockMutation.isPending}
                onClick={() => mockMutation.mutate(tier.id)}
              >
                Join (test)
              </Button>
            )}
          </li>
        ))}
      </ul>
      {(bundles ?? []).length > 0 ? (
        <div className="space-y-2 border-t border-outline-variant/30 pt-3">
          <p className="text-xs font-medium text-outline">Product bundles</p>
          {(bundles ?? []).map((bundle) => (
            <div key={bundle.id} className="rounded-lg border border-outline-variant/30 p-3 text-sm">
              <p className="font-medium">{bundle.name}</p>
              {bundle.description ? (
                <p className="mt-1 text-xs text-on-surface-variant">{bundle.description}</p>
              ) : null}
              <ul className="mt-2 space-y-0.5 text-xs text-on-surface-variant">
                {bundle.items.map((item, i) => (
                  <li key={i}>
                    Includes {item.resourceType}
                    {item.resourceId ? ` · ${item.resourceId.slice(0, 8)}…` : ''}
                  </li>
                ))}
              </ul>
              {useStripe ? (
                <Button
                  variant="secondary"
                  className="mt-2 text-xs"
                  disabled={checkoutMutation.isPending}
                  onClick={() => checkoutMutation.mutate(bundle.tierId)}
                >
                  Get bundle
                  {bundle.tier
                    ? ` — ${bundle.tier.currency} ${(bundle.tier.priceCents / 100).toFixed(0)}/${bundle.tier.billingInterval}`
                    : ''}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="mt-2 text-xs"
                  disabled={mockMutation.isPending}
                  onClick={() => mockMutation.mutate(bundle.tierId)}
                >
                  Join bundle (test)
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {!useStripe ? (
        <p className="text-xs text-on-surface-variant">
          Test memberships only — enable Stripe for real billing.
        </p>
      ) : null}
    </div>
  );
}
