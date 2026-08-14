'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, PageHeader } from '@forge/design-system';
import { useToast } from '@forge/design-system/client';
import { api } from '@/lib/api';

type Report = {
  id: string;
  communityId: string;
  channelId?: string;
  messageId?: string;
  reporterId?: string;
  reason: string;
  status: string;
  createdAt: string;
};

type CommunityRow = {
  id: string;
  name: string;
  slug: string;
  visibility: string;
  creatorId: string;
  creator?: { username?: string; displayName?: string; email?: string } | null;
  createdAt: string;
};

type CommunityDetail = CommunityRow & {
  stats?: { activeSubscribers: number; engagedMembers: number; openReports: number };
  connect?: {
    connected: boolean;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    message?: string;
  };
};

type ChannelMessage = {
  id: string;
  body: string;
  userId: string;
  user?: { displayName?: string; username?: string };
};

type ConnectRow = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  stripeConnectAccountId?: string | null;
  connect: {
    connected: boolean;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    message?: string;
  };
};

export default function AdminCommunityPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<'reports' | 'communities' | 'connect'>('reports');
  const [search, setSearch] = useState('');
  const [connectFilter, setConnectFilter] = useState<'all' | 'connected' | 'incomplete' | 'none'>('all');
  const [expandedCommunityId, setExpandedCommunityId] = useState<string | null>(null);

  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['admin-community-reports'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Report[] }>('/admin/community-reports');
      return data.data;
    },
    enabled: tab === 'reports',
  });

  const { data: communities, isLoading: communitiesLoading } = useQuery({
    queryKey: ['admin-communities', search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (search.trim()) params.set('search', search.trim());
      const { data } = await api.get<{ data: CommunityRow[] }>(
        `/admin/communities?${params.toString()}`,
      );
      return data.data;
    },
    enabled: tab === 'communities',
  });

  const { data: connectRows, isLoading: connectLoading } = useQuery({
    queryKey: ['admin-creator-connect', search, connectFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50', filter: connectFilter });
      if (search.trim()) params.set('search', search.trim());
      const { data } = await api.get<{ data: ConnectRow[] }>(
        `/admin/creators/connect-status?${params.toString()}`,
      );
      return data.data;
    },
    enabled: tab === 'connect',
  });

  const resolveMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await api.patch(`/admin/community-reports/${reportId}/resolve`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-community-reports'] });
      toast({ title: 'Report resolved', variant: 'success' });
    },
    onError: () => toast({ title: 'Could not resolve report', variant: 'critical' }),
  });

  const updateCommunityMutation = useMutation({
    mutationFn: async ({ id, visibility }: { id: string; visibility: string }) => {
      await api.patch(`/admin/communities/${id}`, { visibility });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-communities', search] });
      toast({ title: 'Community updated', variant: 'success' });
    },
    onError: () => toast({ title: 'Could not update community', variant: 'critical' }),
  });

  const { data: communityDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-community-detail', expandedCommunityId],
    enabled: tab === 'communities' && !!expandedCommunityId,
    queryFn: async () => {
      const { data } = await api.get<{ data: CommunityDetail }>(
        `/admin/communities/${expandedCommunityId}`,
      );
      return data.data;
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader
        title="Community oversight"
        subtitle="Platform reports and community directory"
      />

      <div className="mb-6 flex gap-2">
        <Button
          variant={tab === 'reports' ? 'primary' : 'secondary'}
          onClick={() => setTab('reports')}
        >
          Reports
        </Button>
        <Button
          variant={tab === 'communities' ? 'primary' : 'secondary'}
          onClick={() => setTab('communities')}
        >
          Communities
        </Button>
        <Button
          variant={tab === 'connect' ? 'primary' : 'secondary'}
          onClick={() => setTab('connect')}
        >
          Connect
        </Button>
      </div>

      {tab === 'reports' ? (
        reportsLoading ? (
          <ul className="space-y-3" aria-busy="true" aria-label="Loading reports">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="animate-pulse rounded-xl border border-outline-variant/30 px-4 py-3">
                <div className="space-y-2">
                  <div className="h-4 w-40 rounded bg-surface-container-high" />
                  <div className="h-3 w-56 rounded bg-surface-container-high" />
                  <div className="h-8 w-28 rounded bg-surface-container-high mt-2" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-3">
            {(reports ?? []).map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                onResolve={() => resolveMutation.mutate(r.id)}
                resolving={resolveMutation.isPending}
              />
            ))}
            {(reports ?? []).length === 0 ? (
              <p className="text-sm text-on-surface-variant">No open community reports.</p>
            ) : null}
          </ul>
        )
      ) : tab === 'communities' ? (
        <>
          <Input
            className="mb-4 max-w-md"
            placeholder="Search by name, slug, or creator…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {communitiesLoading ? (
            <ul className="space-y-2" aria-busy="true" aria-label="Loading communities">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="animate-pulse rounded-xl border border-outline-variant/30 px-4 py-3">
                  <div className="space-y-2">
                    <div className="h-4 w-36 rounded bg-surface-container-high" />
                    <div className="h-3 w-52 rounded bg-surface-container-high" />
                    <div className="h-3 w-44 rounded bg-surface-container-high" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              {(communities ?? []).map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {c.name}{' '}
                        <span className="text-xs font-normal text-outline">/{c.slug}</span>
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {c.visibility} · creator{' '}
                        {c.creator?.displayName || c.creator?.username || c.creatorId}
                        {c.creator?.email ? ` · ${c.creator.email}` : ''}
                      </p>
                      <p className="text-xs text-outline">
                        {new Date(c.createdAt).toLocaleDateString()} · id {c.id}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      className="text-xs"
                      onClick={() =>
                        setExpandedCommunityId(expandedCommunityId === c.id ? null : c.id)
                      }
                    >
                      {expandedCommunityId === c.id ? 'Hide detail' : 'View detail'}
                    </Button>
                  </div>
                  {expandedCommunityId === c.id ? (
                    detailLoading ? (
                      <p className="mt-3 text-xs text-on-surface-variant">Loading detail…</p>
                    ) : communityDetail?.id === c.id ? (
                      <div className="mt-3 space-y-2 rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                        <p>
                          Members: {communityDetail.stats?.activeSubscribers ?? 0} paying ·{' '}
                          {communityDetail.stats?.engagedMembers ?? 0} engaged (XP)
                        </p>
                        <p>Open reports: {communityDetail.stats?.openReports ?? 0}</p>
                        <p>
                          Connect:{' '}
                          {communityDetail.connect?.chargesEnabled &&
                          communityDetail.connect?.payoutsEnabled
                            ? 'Charges + payouts enabled'
                            : communityDetail.connect?.connected
                              ? 'Onboarding incomplete'
                              : 'Not connected'}
                        </p>
                        {communityDetail.connect?.message ? (
                          <p className="text-outline">{communityDetail.connect.message}</p>
                        ) : null}
                      </div>
                    ) : null
                  ) : null}
                  <label className="mt-2 block text-xs text-on-surface-variant">
                    Visibility
                    <select
                      className="mt-1 block rounded-lg border border-outline-variant/40 bg-surface-container px-2 py-1 text-xs"
                      value={c.visibility}
                      disabled={updateCommunityMutation.isPending}
                      onChange={(e) =>
                        updateCommunityMutation.mutate({ id: c.id, visibility: e.target.value })
                      }
                    >
                      <option value="public">public</option>
                      <option value="private">private</option>
                      <option value="paid">paid</option>
                      <option value="invite">invite</option>
                    </select>
                  </label>
                </li>
              ))}
              {(communities ?? []).length === 0 ? (
                <p className="text-sm text-on-surface-variant">No communities found.</p>
              ) : null}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {(['all', 'connected', 'incomplete', 'none'] as const).map((f) => (
              <Button
                key={f}
                variant={connectFilter === f ? 'primary' : 'secondary'}
                className="text-xs"
                onClick={() => setConnectFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>
          <Input
            className="mb-4 max-w-md"
            placeholder="Search creators…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {connectLoading ? (
            <ul className="space-y-2" aria-busy="true" aria-label="Loading connect status">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="animate-pulse rounded-xl border border-outline-variant/30 px-4 py-3">
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-surface-container-high" />
                    <div className="h-3 w-40 rounded bg-surface-container-high" />
                    <div className="h-3 w-48 rounded bg-surface-container-high" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              {(connectRows ?? []).map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm"
                >
                  <p className="font-medium">{row.displayName || row.username}</p>
                  <p className="text-xs text-on-surface-variant">{row.email}</p>
                  <p className="mt-1 text-xs">
                    {row.connect.chargesEnabled && row.connect.payoutsEnabled
                      ? '✓ Charges + payouts enabled'
                      : row.connect.connected
                        ? '⚠ Onboarding incomplete'
                        : '— Not connected'}
                  </p>
                  {row.connect.message ? (
                    <p className="text-xs text-outline">{row.connect.message}</p>
                  ) : null}
                </li>
              ))}
              {(connectRows ?? []).length === 0 ? (
                <p className="text-sm text-on-surface-variant">No creators match this filter.</p>
              ) : null}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function ReportCard({
  report,
  onResolve,
  resolving,
}: {
  report: Report;
  onResolve: () => void;
  resolving: boolean;
}) {
  const { data: message } = useQuery({
    queryKey: ['report-message', report.channelId, report.messageId],
    enabled: !!report.channelId && !!report.messageId,
    queryFn: async () => {
      const { data } = await api.get<{ data: ChannelMessage }>(
        `/channels/${report.channelId}/messages/${report.messageId}`,
      );
      return data.data;
    },
  });

  return (
    <li className="rounded-xl border border-outline-variant/30 px-4 py-3">
      <p className="text-sm font-medium">{report.reason}</p>
      <p className="text-xs text-on-surface-variant">
        Community {report.communityId}
        {report.channelId ? ` · channel ${report.channelId}` : ''}
      </p>
      {message ? (
        <p className="mt-2 rounded-lg bg-surface-container-high px-3 py-2 text-xs">
          {message.body}
        </p>
      ) : null}
      <Button
        variant="secondary"
        className="mt-3 text-xs"
        disabled={resolving || report.status !== 'open'}
        onClick={onResolve}
      >
        Mark resolved
      </Button>
    </li>
  );
}
