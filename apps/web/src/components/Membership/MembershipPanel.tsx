'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

  return (
    <div className="glass-panel space-y-3 rounded-xl p-4">
      <p className="text-sm font-medium">Become a member</p>
      <ul className="space-y-2">
        {tiers.map((tier) => (
          <li key={tier.id} className="flex items-center justify-between text-sm">
            <span>
              {tier.name} — {tier.currency} {(tier.priceCents / 100).toFixed(0)}/mo
            </span>
            <button
              type="button"
              disabled={mockMutation.isPending}
              onClick={() => mockMutation.mutate(tier.id)}
              className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-on-primary disabled:opacity-40"
            >
              Join (test)
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-on-surface-variant">
        Test memberships only — real billing coming in Phase 2.
      </p>
    </div>
  );
}
