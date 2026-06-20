'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SubscriptionTier } from '@/types';

interface Props {
  creatorId: string;
}

export function MembershipPanel({ creatorId }: Props) {
  const { user, isGuest } = useAuth();
  const qc = useQueryClient();

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
          <span className="ml-2 rounded-full bg-tertiary/20 px-2 py-0.5 text-xs text-tertiary">
            Test membership
          </span>
        ) : null}
      </div>
    );
  }

  if (isGuest || !tiers?.length) return null;

  const useStripe = process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true';

  return (
    <div className="glass-panel w-full max-w-md space-y-3 rounded-xl p-4">
      <p className="text-sm font-medium">Become a member</p>
      <ul className="space-y-2">
        {tiers.map((tier) => (
          <li key={tier.id} className="flex items-center justify-between text-sm">
            <span>
              {tier.name} — {tier.currency} {(tier.priceCents / 100).toFixed(0)}/mo
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
      {!useStripe ? (
        <p className="text-xs text-on-surface-variant">
          Test memberships only — enable Stripe for real billing.
        </p>
      ) : null}
    </div>
  );
}
