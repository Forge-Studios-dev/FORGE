'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, StatCard } from '@forge/design-system';
import { api } from '@/lib/api';

interface Stats {
  userCount: number;
  videoCount: number;
  readyVideoCount: number;
}

interface PendingCreator {
  id: string;
  displayName: string;
  username: string;
  creatorRequestedAt: string | null;
}

interface PlatformChurnKpi {
  windowDays: number;
  churnRate: number;
  retentionRate: number;
}

interface EngagementScoreKpi {
  userId: string;
  score: number;
  label: 'high' | 'medium' | 'low' | 'inactive';
}

interface PlatformKpiDashboard {
  churn: PlatformChurnKpi;
  topEngaged: EngagementScoreKpi[];
}

/** Thresholds from docs/CREATOR_KPI_DEFINITIONS.md — churn >8% warns, >15% is critical. */
function churnStatus(churnRate: number): { label: string; className: string } {
  if (churnRate > 0.15) return { label: 'critical', className: 'bg-critical/15 text-critical' };
  if (churnRate > 0.08) return { label: 'elevated', className: 'bg-warning/15 text-warning' };
  return { label: 'healthy', className: 'bg-success/15 text-success' };
}

const ENGAGEMENT_LABEL_CLASS: Record<EngagementScoreKpi['label'], string> = {
  high: 'bg-success/15 text-success',
  medium: 'bg-secondary/15 text-secondary',
  low: 'bg-warning/15 text-warning',
  inactive: 'bg-critical/15 text-critical',
};

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await api.get('/admin/stats');
      return data.data;
    },
  });

  const { data: pending } = useQuery({
    queryKey: ['admin-creators-pending-preview'],
    queryFn: async () => {
      const { data } = await api.get('/admin/creators/pending?limit=5');
      return data.data as { data: PendingCreator[]; meta: { total: number } };
    },
  });

  const { data: reports } = useQuery({
    queryKey: ['admin-reports-preview'],
    queryFn: async () => {
      const { data } = await api.get('/admin/reports?limit=5&status=pending');
      return data.data as { data: { id: string; reason: string; createdAt: string }[] };
    },
  });

  const { data: kpi } = useQuery<PlatformKpiDashboard>({
    queryKey: ['admin-kpi-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/kpi/platform/dashboard');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (statsLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass-panel h-28 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  const churn = kpi?.churn ? churnStatus(kpi.churn.churnRate) : null;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform overview" />
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/users" className="block transition hover:-translate-y-0.5">
          <StatCard label="Total users" value={stats?.userCount ?? 0} icon="group" />
        </Link>
        <Link href="/content" className="block transition hover:-translate-y-0.5">
          <StatCard label="Total videos" value={stats?.videoCount ?? 0} icon="video_library" />
        </Link>
        <Link href="/content" className="block transition hover:-translate-y-0.5">
          <StatCard label="Published videos" value={stats?.readyVideoCount ?? 0} icon="visibility" />
        </Link>
        <Link href="/creator-approvals" className="block transition hover:-translate-y-0.5">
          <StatCard
            label="Pending approvals"
            value={pending?.meta?.total ?? pending?.data?.length ?? 0}
            icon="verified"
          />
        </Link>
      </div>

      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        <div className="glass-panel flex flex-col gap-3 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-on-surface-variant">30-day churn</span>
            {churn ? (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${churn.className}`}>{churn.label}</span>
            ) : null}
          </div>
          <span className="font-display-forge text-3xl font-bold tabular-nums">
            {kpi?.churn ? `${Math.round(kpi.churn.churnRate * 1000) / 10}%` : '—'}
          </span>
        </div>
        <StatCard
          label="30-day retention"
          value={kpi?.churn ? `${Math.round(kpi.churn.retentionRate * 1000) / 10}%` : '—'}
          icon="favorite"
        />
      </div>

      {kpi?.topEngaged?.length ? (
        <section className="glass-panel mb-8 rounded-xl p-6">
          <h2 className="font-display-forge mb-4 text-lg font-semibold">Most engaged users</h2>
          <ul className="space-y-2">
            {kpi.topEngaged.slice(0, 8).map((u) => (
              <li key={u.userId} className="flex items-center justify-between border-b border-outline-variant/20 pb-2 last:border-0">
                <Link href={`/users/${u.userId}`} className="font-mono text-xs text-on-surface-variant hover:text-primary">
                  {u.userId.slice(0, 8)}…
                </Link>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-sm text-on-surface">{u.score}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ENGAGEMENT_LABEL_CLASS[u.label]}`}>
                    {u.label}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="glass-panel mb-8 rounded-xl p-6">
        <h2 className="font-display-forge mb-4 text-lg font-semibold">Recent approvals</h2>
        {pending?.data?.length ? (
          <ul className="space-y-3">
            {pending.data.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between border-b border-outline-variant/20 pb-3 last:border-0"
              >
                <Link href={`/users/${a.id}`} className="hover:text-primary">
                  {a.displayName || a.username}
                </Link>
                <span className="text-xs text-outline">
                  {a.creatorRequestedAt ? new Date(a.creatorRequestedAt).toLocaleDateString() : '—'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">No pending creator requests.</p>
        )}
        <Link href="/creator-approvals" className="mt-4 inline-block text-sm text-primary hover:underline">
          View all approvals →
        </Link>
      </section>

      <section className="glass-panel rounded-xl p-6">
        <h2 className="font-display-forge mb-4 text-lg font-semibold">Open reports</h2>
        {reports?.data?.length ? (
          <ul className="space-y-3">
            {reports.data.map((r) => (
              <li key={r.id} className="border-b border-outline-variant/20 pb-3 last:border-0">
                <Link href={`/reports/${r.id}`} className="text-sm text-primary hover:underline">
                  Report #{r.id.slice(0, 8)}…
                </Link>
                <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{r.reason}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">No open reports.</p>
        )}
        <Link href="/reports" className="mt-4 inline-block text-sm text-primary hover:underline">
          View reports inbox →
        </Link>
      </section>
    </div>
  );
}
