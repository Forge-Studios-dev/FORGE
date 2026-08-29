'use client';

import Link from 'next/link';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button, EmptyState, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';
import { timeAgo } from '@/lib/utils';

type SuperThanksRow = {
  id: string;
  videoId: string;
  videoTitle: string | null;
  tipperId: string;
  tipper: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  amountCents: number;
  currency: string;
  body: string | null;
  createdAt: string;
};

type SuperThanksResponse = {
  data: SuperThanksRow[];
  summary: {
    totalTips: number;
    totalAmountCents: number;
    totalPlatformFeeCents?: number;
    totalCreatorNetCents?: number;
  };
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
};

type DailySummary = {
  days: number;
  since: string;
  daysBreakdown: Array<{
    day: string;
    tipCount: number;
    grossCents: number;
    platformFeeCents: number;
    creatorNetCents: number;
  }>;
};

const PAGE_SIZE = 50;

export default function StudioSuperThanksPage() {
  const { isCreator } = useAuth();
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['studio-super-thanks'],
    enabled: isCreator,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const { data: res } = await api.get<{ data: SuperThanksResponse }>(
        `/billing/super-thanks/received?limit=${PAGE_SIZE}&page=${pageParam}`,
      );
      return res.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
  });

  const { data: daily } = useQuery({
    queryKey: ['studio-super-thanks-summary'],
    enabled: isCreator,
    queryFn: async () => {
      const { data: res } = await api.get<{ data: DailySummary }>(
        '/billing/super-thanks/received/summary?days=30',
      );
      return res.data;
    },
  });

  const tips = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const summary = data?.pages[0]?.summary;

  async function downloadCsv() {
    setExporting(true);
    setExportError('');
    try {
      const { data: blob } = await api.get<Blob>('/billing/super-thanks/received/export', {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'super-thanks.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(getApiErrorMessage(e, 'Could not export CSV.'));
    } finally {
      setExporting(false);
    }
  }

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  const breakdown = daily?.daysBreakdown ?? [];

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Super Thanks"
          subtitle="Super Thanks from viewers on your videos. Payouts follow your Stripe Connect balance."
        />
        <button
          type="button"
          disabled={exporting || (summary?.totalTips ?? 0) === 0}
          onClick={() => void downloadCsv()}
          className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:border-primary disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
      {exportError ? (
        <p className="text-sm text-error" role="alert">
          {exportError}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5">
          <p className="font-label-caps text-xs text-outline">Total Super Thanks</p>
          <p className="mt-2 text-2xl font-semibold">{summary?.totalTips ?? 0}</p>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <p className="font-label-caps text-xs text-outline">Gross amount</p>
          <p className="mt-2 text-2xl font-semibold">
            ${(((summary?.totalAmountCents ?? 0) as number) / 100).toFixed(2)}
          </p>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <p className="font-label-caps text-xs text-outline">Your net (after platform fee)</p>
          <p className="mt-2 text-2xl font-semibold text-secondary">
            $
            {(
              ((summary?.totalCreatorNetCents ?? summary?.totalAmountCents ?? 0) as number) / 100
            ).toFixed(2)}
          </p>
          {(summary?.totalPlatformFeeCents ?? 0) > 0 ? (
            <p className="mt-1 text-xs text-outline">
              Platform fee ${((summary!.totalPlatformFeeCents ?? 0) / 100).toFixed(2)}
            </p>
          ) : null}
        </div>
      </div>

      {breakdown.length > 0 ? (
        <section className="glass-panel overflow-hidden rounded-2xl">
          <div className="border-b border-outline-variant/20 px-5 py-3">
            <h2 className="text-sm font-semibold">Last {daily?.days ?? 30} days</h2>
            <p className="text-xs text-outline">Daily totals for payout reconciliation</p>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface-container text-xs text-outline">
                <tr>
                  <th className="px-5 py-2 font-medium">Day</th>
                  <th className="px-3 py-2 font-medium">Super Thanks</th>
                  <th className="px-3 py-2 font-medium">Gross</th>
                  <th className="px-3 py-2 font-medium">Fee</th>
                  <th className="px-5 py-2 font-medium">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {breakdown.map((row) => (
                  <tr key={row.day}>
                    <td className="px-5 py-2 tabular-nums">{row.day}</td>
                    <td className="px-3 py-2 tabular-nums">{row.tipCount}</td>
                    <td className="px-3 py-2 tabular-nums">${(row.grossCents / 100).toFixed(2)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      ${(row.platformFeeCents / 100).toFixed(2)}
                    </td>
                    <td className="px-5 py-2 tabular-nums font-medium">
                      ${(row.creatorNetCents / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading Super Thanks…</p>
      ) : isError ? (
        <EmptyState title="Couldn’t load Super Thanks" description="Try again in a moment." />
      ) : tips.length === 0 ? (
        <EmptyState
          title="No Super Thanks yet"
          description="When viewers send Super Thanks, they appear here."
        />
      ) : (
        <div className="space-y-4">
          <ul className="glass-panel divide-y divide-outline-variant/20 overflow-hidden rounded-2xl">
            {tips.map((tip) => (
              <li key={tip.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-on-surface">
                    {tip.tipper?.displayName ?? 'Viewer'}{' '}
                    <span className="font-normal text-on-surface-variant">
                      sent ${(tip.amountCents / 100).toFixed(2)}
                    </span>
                  </p>
                  {tip.body ? (
                    <p className="text-sm text-on-surface-variant">“{tip.body}”</p>
                  ) : null}
                  <p className="text-xs text-outline">
                    {tip.videoTitle ? (
                      <Link href={`/watch/${tip.videoId}`} className="hover:underline">
                        {tip.videoTitle}
                      </Link>
                    ) : (
                      'Video'
                    )}{' '}
                    · {timeAgo(tip.createdAt)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-warning">
                  +${(tip.amountCents / 100).toFixed(2)}
                </p>
              </li>
            ))}
          </ul>
          {hasNextPage ? (
            <Button
              variant="secondary"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          ) : null}
        </div>
      )}
    </main>
  );
}
