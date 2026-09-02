'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, EmptyState, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';

type Reward = {
  id: string;
  title: string;
  description?: string | null;
  costPoints: number;
  requiresApproval?: boolean;
};

type Balance = {
  balance: number;
  totalEarned: number;
};

function unwrapList<T>(payload: T[] | { data?: T[] } | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export function CommunityChannelPointsPanel({ communityId }: { communityId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['community-channel-points-me', communityId],
    enabled: !!user && !!communityId,
    queryFn: async () => {
      const { data } = await api.get<{ data: Balance }>(
        `/communities/${communityId}/channel-points/me`,
      );
      return data.data;
    },
  });

  const { data: rewards = [], isLoading: rewardsLoading } = useQuery({
    queryKey: ['community-channel-points-rewards', communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data } = await api.get<{ data: Reward[] | { data: Reward[] } }>(
        `/communities/${communityId}/channel-points/rewards`,
      );
      return unwrapList(data.data);
    },
  });

  const redeem = useMutation({
    mutationFn: async (rewardId: string) => {
      await api.post(`/communities/${communityId}/channel-points/redeem`, { rewardId });
    },
    onSuccess: () => {
      setError('');
      setMessage('Redemption submitted.');
      void qc.invalidateQueries({ queryKey: ['community-channel-points-me', communityId] });
    },
    onError: (e) => {
      setMessage('');
      setError(getApiErrorMessage(e, 'Could not redeem reward.'));
    },
  });

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-error">{error}</p> : null}
      {message ? <p className="text-sm text-secondary">{message}</p> : null}

      <section>
        <h3 className="text-sm font-semibold">Your balance</h3>
        {!user ? (
          <EmptyState
            title="Sign in to earn and redeem"
            description="Channel points are awarded for community activity when the creator enables them."
            action={{ label: 'Sign in', href: '/login' }}
          />
        ) : balanceLoading ? (
          <p className="mt-2 text-sm text-on-surface-variant">Loading…</p>
        ) : (
          <p className="mt-2 text-sm text-on-surface-variant">
            <span className="text-lg font-semibold text-on-surface">{balance?.balance ?? 0}</span>{' '}
            points · {balance?.totalEarned ?? 0} earned all-time
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Rewards</h3>
        {rewardsLoading ? (
          <p className="text-sm text-on-surface-variant">Loading rewards…</p>
        ) : rewards.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No rewards available yet.</p>
        ) : (
          <ul className="space-y-2">
            {rewards.map((reward) => {
              const canAfford = (balance?.balance ?? 0) >= reward.costPoints;
              return (
                <li
                  key={reward.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{reward.title}</p>
                    {reward.description ? (
                      <p className="text-xs text-on-surface-variant">{reward.description}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-2">
                      <StatusPill tone="neutral" label={`${reward.costPoints} pts`} />
                      {reward.requiresApproval ? (
                        <StatusPill tone="warning" label="Needs approval" />
                      ) : null}
                    </div>
                  </div>
                  {user ? (
                    <Button
                      className="text-xs"
                      disabled={!canAfford || redeem.isPending}
                      onClick={() => redeem.mutate(reward.id)}
                    >
                      Redeem
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
