'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { EmptyState, PageHeader, StatCardsSkeleton, StatusPill, type StatusTone } from '@forge/design-system';
import { getMyVideos } from '@/lib/creator-studio';
import { useAuth } from '@/lib/auth';
import { formatCount } from '@/lib/utils';
import { api } from '@/lib/api';
import { CreatorFunnelChart } from '@/components/Community/CreatorFunnelChart';
import { CreatorCohortChart } from '@/components/Community/CreatorCohortChart';

export default function StudioAnalyticsPage() {
  const { user, isCreator } = useAuth();
  const { data: videos, isLoading, isError } = useQuery({
    queryKey: ['studio-analytics', user?.id],
    queryFn: async () => {
      const all = await getMyVideos(user?.id);
      return all.filter((v) => v.status === 'ready');
    },
    enabled: !!user?.id && isCreator,
  });

  const { data: subscriberStats } = useQuery({
    queryKey: ['subscriber-analytics', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { active: number; trial: number; mrrCents: number; canceled: number };
      }>('/creators/me/subscribers/analytics');
      return data.data;
    },
  });

  const { data: ecosystemTree } = useQuery({
    queryKey: ['ecosystem-tree', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          brands: Array<{ id: string; name: string; slug: string }>;
          communities: Array<{
            id: string;
            name: string;
            slug: string;
            courses: Array<{ id: string; title: string }>;
            programs: Array<{ id: string; name: string; courseCount: number }>;
          }>;
          standaloneCourses: Array<{ id: string; title: string }>;
          programs: Array<{ id: string; name: string; courseCount: number }>;
          bundles: Array<{ id: string; name: string; itemCount: number }>;
        };
      }>('/creators/me/ecosystem-tree');
      return data.data;
    },
  });

  const { data: businessAnalytics } = useQuery({
    queryKey: ['business-analytics', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          periodDays: number;
          kpis: {
            churnRate30d: number;
            canceledLast30Days: number;
            engagementScore: number;
          };
          funnel: Array<{
            stage: string;
            label: string;
            count: number;
            rateFromTop: number;
          }>;
          communities: Array<{
            id: string;
            name: string;
            slug: string;
            activeMembersLast7Days: number;
          }>;
          cohortRetention?: {
            weekly: Array<{
              period: string;
              cohortSize: number;
              retained: number;
              engagedRetained: number;
              retentionRate: number;
            }>;
            monthly: Array<{
              period: string;
              cohortSize: number;
              retained: number;
              engagedRetained: number;
              retentionRate: number;
            }>;
          };
        };
      }>('/creators/me/business-analytics');
      return data.data;
    },
  });

  // Thresholds mirror docs/CREATOR_KPI_DEFINITIONS.md §9 (KPI alert thresholds) —
  // keep in sync if those thresholds change.
  const churnStatus = (rate: number): { label: string; tone: StatusTone } =>
    rate > 15 ? { label: 'Critical', tone: 'critical' } : rate > 8 ? { label: 'Watch', tone: 'warning' } : { label: 'Healthy', tone: 'success' };
  const engagementStatus = (score: number): { label: string; tone: StatusTone } =>
    score < 15 ? { label: 'Critical', tone: 'critical' } : score < 30 ? { label: 'Watch', tone: 'warning' } : { label: 'Healthy', tone: 'success' };

  const exportMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get<Blob>('/creators/me/business-analytics/export', {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'business-analytics.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });

  const totalViews = videos?.reduce((sum, v) => sum + (v.viewCount ?? 0), 0) ?? 0;
  const totalLikes = videos?.reduce((sum, v) => sum + (v.likeCount ?? 0), 0) ?? 0;
  const readyCount = videos?.filter((v) => v.status === 'ready').length ?? 0;

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <PageHeader title="Analytics" subtitle="Creator access required." />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Analytics"
          subtitle="Revenue, membership health, engagement, and top content in one command view."
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:border-primary disabled:opacity-60"
          >
            {exportMutation.isPending ? 'Exporting…' : 'Export CSV'}
          </button>
          <Link href="/studio/analytics/details" className="text-sm text-primary hover:underline self-center">
            Per-video breakdown
          </Link>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Total views</p>
          <p className="font-display-forge mt-1 text-2xl font-bold text-primary">{formatCount(totalViews)}</p>
        </article>
        <article className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Published videos</p>
          <p className="font-display-forge mt-1 text-2xl font-bold">{readyCount}</p>
        </article>
        <article className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Active members</p>
          <p className="font-display-forge mt-1 text-2xl font-bold">
            {formatCount(subscriberStats?.active ?? 0)}
          </p>
        </article>
        <article className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">MRR</p>
          <p className="font-display-forge mt-1 text-2xl font-bold">
            ₹{((subscriberStats?.mrrCents ?? 0) / 100).toFixed(0)}
          </p>
        </article>
      </section>

      {subscriberStats ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <article className="glass-panel rounded-2xl p-5">
            <p className="text-sm text-on-surface-variant">Trials</p>
            <p className="font-display-forge mt-1 text-2xl font-bold">{subscriberStats.trial}</p>
          </article>
          <article className="glass-panel rounded-2xl p-5">
            <p className="text-sm text-on-surface-variant">Canceled</p>
            <p className="font-display-forge mt-1 text-2xl font-bold">{subscriberStats.canceled}</p>
          </article>
          <article className="glass-panel rounded-2xl p-5">
            <p className="text-sm text-on-surface-variant">Total likes</p>
            <p className="font-display-forge mt-1 text-2xl font-bold text-secondary">{formatCount(totalLikes)}</p>
          </article>
        </div>
      ) : null}

      {businessAnalytics?.kpis ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-on-surface-variant">Churn (30d)</p>
              <StatusPill
                tone={churnStatus(businessAnalytics.kpis.churnRate30d).tone}
                label={churnStatus(businessAnalytics.kpis.churnRate30d).label}
              />
            </div>
            <p className="font-display-forge mt-1 text-2xl font-bold">
              {businessAnalytics.kpis.churnRate30d}%
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              {businessAnalytics.kpis.canceledLast30Days} cancellation
              {businessAnalytics.kpis.canceledLast30Days === 1 ? '' : 's'} in the last 30 days
            </p>
          </article>
          <article className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-on-surface-variant">Engagement score</p>
              <StatusPill
                tone={engagementStatus(businessAnalytics.kpis.engagementScore).tone}
                label={engagementStatus(businessAnalytics.kpis.engagementScore).label}
              />
            </div>
            <p className="font-display-forge mt-1 text-2xl font-bold">
              {businessAnalytics.kpis.engagementScore}/100
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Active chatters &amp; post authors vs. member base
            </p>
          </article>
        </div>
      ) : null}

      {businessAnalytics?.funnel?.length ? (
        <div className="space-y-6">
          <CreatorFunnelChart stages={businessAnalytics.funnel} />
          {businessAnalytics.cohortRetention ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <CreatorCohortChart
                title="Weekly subscriber cohorts (8w)"
                data={businessAnalytics.cohortRetention.weekly}
              />
              <CreatorCohortChart
                title="Monthly subscriber cohorts (6mo)"
                data={businessAnalytics.cohortRetention.monthly}
              />
            </div>
          ) : null}
          {(businessAnalytics.communities ?? []).length > 0 ? (
            <section className="glass-panel rounded-2xl p-6">
              <h2 className="mb-3 font-label-caps text-outline">Communities (7d active)</h2>
              <ul className="space-y-2">
                {businessAnalytics.communities.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-outline-variant/30 px-3 py-2 text-sm"
                  >
                    <span>{c.name}</span>
                    <span className="text-on-surface-variant">
                      {c.activeMembersLast7Days} active
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {ecosystemTree && (ecosystemTree.communities?.length ?? 0) > 0 ? (
        <section className="glass-panel rounded-2xl p-6">
          <h2 className="mb-3 font-label-caps text-outline">Communities</h2>
          <ul className="space-y-3 text-sm">
            {(ecosystemTree.communities ?? []).map((c) => (
              <li key={c.id} className="rounded-xl border border-outline-variant/30 px-3 py-2">
                <p className="font-medium">{c.name}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isLoading && <StatCardsSkeleton />}
      {isError && <p className="text-error">Failed to load analytics.</p>}

      {!isLoading && !isError && !videos?.length && (
        <EmptyState
          icon="analytics"
          title="No content analytics yet"
          description="Upload videos to start tracking views and engagement."
          action={{ label: 'Upload video', href: '/upload' }}
        />
      )}

      {videos && videos.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Top videos</h2>
          <ul className="space-y-2">
            {videos.slice(0, 5).map((v) => (
              <li
                key={v.id}
                className="glass-panel flex items-center justify-between rounded-xl px-4 py-3 text-sm"
              >
                <span className="truncate font-medium">{v.title}</span>
                <span className="shrink-0 text-primary">{formatCount(v.viewCount)} views</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
