'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button, EmptyState, Input, PageHeader, StatusPill, type StatusTone } from '@forge/design-system';
import { ConfirmDialog } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';
import { SubscriberPicker } from '@/components/Community/SubscriberPicker';
import { SubscriptionTier } from '@/types';

type Subscriber = {
  id: string;
  userId: string;
  username?: string;
  displayName?: string;
  tierName?: string;
  status: string;
  source: string;
  startsAt: string;
  expiresAt?: string | null;
};

type SubscriberAnalytics = {
  active: number;
  trial: number;
  canceled: number;
  total: number;
  byStatus?: Record<string, number>;
};

const PAGE_SIZE = 50;

function statusTone(status: string): StatusTone {
  if (status === 'active' || status === 'trialing') return 'success';
  if (status === 'past_due' || status === 'failed_payment') return 'warning';
  if (status === 'canceled' || status === 'suspended') return 'critical';
  return 'neutral';
}

export default function StudioSubscribersPage() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [grantUserId, setGrantUserId] = useState('');
  const [grantTierId, setGrantTierId] = useState('');
  const [grantCommunityId, setGrantCommunityId] = useState('');
  const [grantDays, setGrantDays] = useState('30');
  const [exportPhase, setExportPhase] = useState<'idle' | 'preparing' | 'downloading' | 'done' | 'error'>('idle');
  const [exportError, setExportError] = useState('');
  const [suspendTargetId, setSuspendTargetId] = useState<string | null>(null);

  const { data: tiers } = useQuery({
    queryKey: ['studio-tiers-grant', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: SubscriptionTier[] }>(
        `/creators/${user!.id}/tiers`,
      );
      return data.data;
    },
  });

  const { data: communities } = useQuery({
    queryKey: ['studio-communities-grant', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: string; name: string }> }>(
        `/creators/${user!.id}/communities`,
      );
      return data.data;
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ['studio-subscribers-analytics', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: SubscriberAnalytics }>(
        '/creators/me/subscribers/analytics',
      );
      return data.data;
    },
  });

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['studio-subscribers', user?.id],
    enabled: !!user?.id && isCreator,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data: res } = await api.get<{ data: Subscriber[] }>(
        `/creators/me/subscribers?limit=${PAGE_SIZE}&offset=${pageParam}`,
      );
      return { items: res.data ?? [], offset: pageParam as number };
    },
    getNextPageParam: (last) =>
      last.items.length < PAGE_SIZE ? undefined : last.offset + PAGE_SIZE,
  });

  const subscribers = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const invalidateSubscriberQueries = () => {
    void qc.invalidateQueries({ queryKey: ['studio-subscribers', user?.id] });
    void qc.invalidateQueries({ queryKey: ['studio-subscribers-analytics', user?.id] });
  };

  const exportMutation = useMutation({
    mutationFn: async () => {
      setExportPhase('preparing');
      setExportError('');
      const { data: blob } = await api.get<Blob>('/creators/me/subscribers/export', {
        responseType: 'blob',
      });
      setExportPhase('downloading');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'subscribers.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      setExportPhase('done');
      window.setTimeout(() => setExportPhase('idle'), 1800);
    },
    onError: (e) => {
      setExportPhase('error');
      setExportError(getApiErrorMessage(e, 'Could not export subscribers.'));
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      await api.post(`/creators/me/subscribers/${subscriptionId}/suspend`);
    },
    onSuccess: () => {
      setSuspendTargetId(null);
      invalidateSubscriberQueries();
    },
  });

  const grantMutation = useMutation({
    mutationFn: async () => {
      await api.post('/creators/me/subscribers/grant', {
        userId: grantUserId,
        tierId: grantTierId,
        ...(grantCommunityId ? { communityId: grantCommunityId } : {}),
        expiresInDays: Number(grantDays) || 30,
      });
    },
    onSuccess: () => {
      setGrantUserId('');
      invalidateSubscriberQueries();
    },
  });

  const byStatus = analytics?.byStatus ?? {};
  const totalCount = analytics?.total ?? subscribers.length;
  const activeCount = analytics?.active ?? byStatus.active ?? 0;
  const trialCount =
    analytics?.trial ?? byStatus.trialing ?? byStatus.trial ?? 0;
  const atRiskCount =
    (byStatus.past_due ?? 0) + (byStatus.failed_payment ?? 0);

  if (!isCreator) {
    return (
      <main className="space-y-6">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Members"
          subtitle="Track membership lifecycle, grant complimentary access, and export member data."
        />
        <Button
          variant="outline"
          disabled={exportMutation.isPending || exportPhase === 'preparing' || exportPhase === 'downloading'}
          onClick={() => exportMutation.mutate()}
        >
          {exportMutation.isPending ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      {exportPhase !== 'idle' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-panel w-full max-w-sm space-y-3 rounded-2xl p-6 text-center">
            <p className="font-label-caps text-xs text-outline">CSV export</p>
            <h2 className="text-lg font-semibold">
              {exportPhase === 'preparing'
                ? 'Preparing export…'
                : exportPhase === 'downloading'
                  ? 'Downloading file…'
                  : exportPhase === 'done'
                    ? 'Export ready'
                    : 'Export failed'}
            </h2>
            <p className="text-sm text-on-surface-variant">
              {exportPhase === 'error'
                ? exportError || 'Could not export subscribers.'
                : exportPhase === 'done'
                  ? 'subscribers.csv has been downloaded.'
                  : 'This can take a moment for larger member lists.'}
            </p>
            {exportPhase === 'error' || exportPhase === 'done' ? (
              <Button variant="secondary" onClick={() => setExportPhase('idle')}>
                Close
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Total</p>
          <p className="mt-2 text-3xl font-semibold">{totalCount}</p>
        </article>
        <article className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Active</p>
          <p className="mt-2 text-3xl font-semibold">{activeCount}</p>
        </article>
        <article className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Trials</p>
          <p className="mt-2 text-3xl font-semibold">{trialCount}</p>
        </article>
        <article className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">At risk</p>
          <p className="mt-2 text-3xl font-semibold">{atRiskCount}</p>
        </article>
      </section>

      <section className="glass-panel space-y-3 rounded-2xl p-6">
        <h2 className="font-label-caps text-outline">Grant complimentary access</h2>
        <SubscriberPicker
          value={grantUserId}
          onChange={setGrantUserId}
          placeholder="Search subscribers or paste user id"
        />
        <Input
          value={grantUserId}
          onChange={(e) => setGrantUserId(e.target.value.trim())}
          placeholder="Or enter user UUID directly"
        />
        <label className="block text-xs text-on-surface-variant">
          Tier
          <select
            className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface-container-high px-2 py-1.5 text-sm"
            value={grantTierId}
            onChange={(e) => setGrantTierId(e.target.value)}
          >
            <option value="">Select tier…</option>
            {(tiers ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-on-surface-variant">
          Community scope (optional)
          <select
            className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface-container-high px-2 py-1.5 text-sm"
            value={grantCommunityId}
            onChange={(e) => setGrantCommunityId(e.target.value)}
          >
            <option value="">Creator-wide</option>
            {(communities ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Input
          type="number"
          min={1}
          value={grantDays}
          onChange={(e) => setGrantDays(e.target.value)}
          placeholder="Expires in days"
        />
        <Button
          disabled={!grantUserId || !grantTierId || grantMutation.isPending}
          onClick={() => grantMutation.mutate()}
        >
          Grant membership
        </Button>
      </section>

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : isError ? (
        <div className="space-y-2">
          <p className="text-sm text-error">Failed to load subscribers.</p>
          <Button
            variant="secondary"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      ) : subscribers.length === 0 ? (
        <EmptyState
          icon="group"
          title="No subscribers yet"
          description="Members who join a paid tier will show up here."
        />
      ) : (
        <>
          <ul className="space-y-2">
            {subscribers.map((s) => (
              <li key={s.id} className="glass-panel flex items-center justify-between gap-4 rounded-2xl p-4">
                <div className="min-w-0">
                  <p className="font-medium">{s.displayName ?? s.username ?? s.userId}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {s.tierName ?? 'No tier'} · {s.source}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusPill tone={statusTone(s.status)} label={s.status.replace(/_/g, ' ')} />
                  <Button
                    variant="ghost"
                    className="text-xs text-error"
                    disabled={suspendMutation.isPending}
                    onClick={() => setSuspendTargetId(s.id)}
                  >
                    Suspend
                  </Button>
                </div>
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
        </>
      )}

      <ConfirmDialog
        open={!!suspendTargetId}
        title="Suspend membership?"
        description="The member will lose access until you reinstate them."
        confirmLabel="Suspend"
        onConfirm={() => {
          if (suspendTargetId) suspendMutation.mutate(suspendTargetId);
        }}
        onCancel={() => setSuspendTargetId(null)}
        loading={suspendMutation.isPending}
      />
    </main>
  );
}
