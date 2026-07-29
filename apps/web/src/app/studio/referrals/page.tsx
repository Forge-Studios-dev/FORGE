'use client';

import { useQuery } from '@tanstack/react-query';
import { EmptyState, Icon, ListSkeleton, PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useState } from 'react';

type ReferralStats = {
  code: string;
  referralUrl: string;
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalXpEarned: number;
  isAmbassador: boolean;
};

type LeaderboardRow = {
  userId: string;
  completedReferrals: number;
  isAmbassador: boolean;
};

export default function StudioReferralsPage() {
  const { isCreator, canEngage } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['studio-referrals'],
    enabled: canEngage,
    queryFn: async () => {
      const { data } = await api.get<{ data: ReferralStats }>('/me/referral');
      return data.data;
    },
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['referral-ambassador-leaderboard'],
    enabled: canEngage,
    queryFn: async () => {
      const { data } = await api.get<{ data: LeaderboardRow[] | { data: LeaderboardRow[] } }>(
        '/platform/ambassadors?limit=10',
      );
      const payload = data.data;
      return Array.isArray(payload) ? payload : payload?.data ?? [];
    },
  });

  const copyLink = async () => {
    if (!data?.referralUrl) return;
    await navigator.clipboard.writeText(data.referralUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (!canEngage) {
    return (
      <main className="space-y-4">
        <PageHeader title="Referrals" subtitle="Sign in to view your referral program." />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Referrals"
        subtitle="Share your invite link, track completions, and climb the ambassador leaderboard."
      />

      {isLoading ? <ListSkeleton rows={3} /> : null}
      {isError ? <p className="text-sm text-error">Failed to load referral stats.</p> : null}

      {data ? (
        <>
          <section className="glass-panel space-y-4 rounded-2xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-label-caps text-xs text-outline">Your invite</p>
                <h2 className="mt-1 text-lg font-semibold">Code {data.code}</h2>
                <p className="mt-2 break-all text-sm text-on-surface-variant">{data.referralUrl}</p>
              </div>
              {data.isAmbassador ? <StatusPill tone="reward" label="Ambassador" /> : null}
            </div>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="primary-button inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-on-primary"
            >
              <Icon name="content_copy" />
              {copied ? 'Copied' : 'Copy invite link'}
            </button>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="glass-panel rounded-2xl p-5">
              <p className="text-sm text-on-surface-variant">Total referrals</p>
              <p className="mt-2 text-3xl font-semibold">{data.totalReferrals}</p>
            </article>
            <article className="glass-panel rounded-2xl p-5">
              <p className="text-sm text-on-surface-variant">Completed</p>
              <p className="mt-2 text-3xl font-semibold">{data.completedReferrals}</p>
            </article>
            <article className="glass-panel rounded-2xl p-5">
              <p className="text-sm text-on-surface-variant">Pending</p>
              <p className="mt-2 text-3xl font-semibold">{data.pendingReferrals}</p>
            </article>
            <article className="glass-panel rounded-2xl p-5">
              <p className="text-sm text-on-surface-variant">XP earned</p>
              <p className="mt-2 text-3xl font-semibold">{data.totalXpEarned}</p>
            </article>
          </section>
        </>
      ) : null}

      {!isLoading && !data && !isError ? (
        <EmptyState
          icon="share"
          title="Referral program unavailable"
          description="Your invite stats could not be loaded right now."
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ambassador leaderboard</h2>
        {(leaderboard ?? []).length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            Ambassadors appear here after 10+ completed referrals.
          </p>
        ) : (
          <ul className="space-y-2">
            {(leaderboard ?? []).map((row, index) => (
              <li
                key={row.userId}
                className="glass-panel flex items-center justify-between rounded-xl px-4 py-3 text-sm"
              >
                <span>
                  #{index + 1} · {row.userId.slice(0, 8)}
                </span>
                <span className="text-on-surface-variant">
                  {row.completedReferrals} completed
                  {row.isAmbassador ? ' · Ambassador' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!isCreator ? (
          <p className="text-xs text-outline">
            Anyone can refer friends. Creators also unlock Studio growth tools alongside referrals.
          </p>
        ) : null}
      </section>
    </main>
  );
}
