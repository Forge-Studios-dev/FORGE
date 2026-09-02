'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { AdminSkillFeatureGate } from '@/components/AdminSkillFeatureGate';

type SummaryRow = {
  communityId: string;
  name: string;
  slug: string;
  membersWithBalance: number;
  totalBalance: number;
  totalEarned: number;
  pendingRedemptions: number;
};

type RedemptionRow = {
  id: string;
  status: string;
  costPoints: number;
  createdAt: string;
  community?: { id: string; name: string; slug: string } | null;
  reward?: { title?: string; costPoints?: number } | null;
  user?: { username?: string; displayName?: string } | null;
};

export default function ChannelPointsOversightPage() {
  return (
    <AdminSkillFeatureGate feature="channelPoints">
      <ChannelPointsOversightInner />
    </AdminSkillFeatureGate>
  );
}

function ChannelPointsOversightInner() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['admin-channel-points-summary'],
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: SummaryRow[] } }>(
        '/admin/channel-points/summary?limit=50',
      );
      return data.data?.data ?? data.data ?? [];
    },
  });

  const { data: pending, isLoading: pendingLoading } = useQuery({
    queryKey: ['admin-channel-points-pending'],
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: RedemptionRow[] } }>(
        '/admin/channel-points/redemptions?limit=50',
      );
      return data.data?.data ?? data.data ?? [];
    },
  });

  const summaryRows = Array.isArray(summary) ? summary : [];
  const pendingRows = Array.isArray(pending) ? pending : [];

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 md:px-12">
      <PageHeader
        title="Channel points oversight"
        subtitle="Cross-community balances and pending redemptions"
      />

      <h3 className="mt-8 text-sm font-semibold">Communities with activity</h3>
      {summaryLoading ? (
        <p className="mt-3 text-sm text-on-surface-variant" aria-busy="true">
          Loading summary…
        </p>
      ) : summaryRows.length === 0 ? (
        <p className="mt-3 text-sm text-on-surface-variant">No channel-point activity yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {summaryRows.map((row) => (
            <li
              key={row.communityId}
              className="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {row.name}{' '}
                  <span className="text-xs font-normal text-outline">/{row.slug}</span>
                </p>
                {row.pendingRedemptions > 0 ? (
                  <StatusPill
                    tone="warning"
                    label={`${row.pendingRedemptions} pending`}
                  />
                ) : null}
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">
                {row.membersWithBalance} members · {row.totalBalance} balance · {row.totalEarned}{' '}
                earned
              </p>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-10 text-sm font-semibold">Pending redemptions</h3>
      {pendingLoading ? (
        <p className="mt-3 text-sm text-on-surface-variant" aria-busy="true">
          Loading redemptions…
        </p>
      ) : pendingRows.length === 0 ? (
        <p className="mt-3 text-sm text-on-surface-variant">No pending redemptions.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {pendingRows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm"
            >
              <p className="font-medium">
                {row.reward?.title ?? 'Reward'} · {row.costPoints} pts
              </p>
              <p className="text-xs text-on-surface-variant">
                {row.community?.name ?? 'Community'} ·{' '}
                {row.user?.displayName || row.user?.username || 'Member'} ·{' '}
                {new Date(row.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
