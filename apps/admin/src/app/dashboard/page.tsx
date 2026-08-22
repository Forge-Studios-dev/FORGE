'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertStrip, PageHeader, StatCard, StatusPill, type StatusTone } from '@forge/design-system';
import { api } from '@/lib/api';

/** Adapts next/link to AlertStrip's plain `{ href, className, children }` link contract. */
function AttentionLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

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

interface FraudAlertPreview {
  id: string;
  userId: string;
  signal: string;
  riskScore: number;
  createdAt: string;
}

/** One row in the unified triage queue below — merges approvals, reports, and fraud
 *  alerts (three separate admin pages) into a single severity-ranked list, so an
 *  operator's first screen answers "what needs me right now" without visiting each
 *  queue separately to find out. */
type AttentionItem = {
  id: string;
  kind: 'approval' | 'report' | 'fraud';
  label: string;
  detail: string;
  href: string;
  severity: number;
  tone: StatusTone;
  toneLabel: string;
  createdAt: string;
};

function fraudTone(riskScore: number): { tone: StatusTone; label: string } {
  if (riskScore >= 80) return { tone: 'critical', label: 'high risk' };
  if (riskScore >= 50) return { tone: 'warning', label: 'medium risk' };
  return { tone: 'neutral', label: 'low risk' };
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
function churnStatus(churnRate: number): { label: string; tone: StatusTone } {
  if (churnRate > 0.15) return { label: 'critical', tone: 'critical' };
  if (churnRate > 0.08) return { label: 'elevated', tone: 'warning' };
  return { label: 'healthy', tone: 'success' };
}

const ENGAGEMENT_LABEL_TONE: Record<EngagementScoreKpi['label'], StatusTone> = {
  high: 'success',
  medium: 'primary',
  low: 'warning',
  inactive: 'critical',
};

export default function DashboardPage() {
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await api.get('/admin/stats');
      return data.data;
    },
  });

  const {
    data: pending,
    isError: pendingError,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ['admin-creators-pending-preview'],
    queryFn: async () => {
      const { data } = await api.get('/admin/creators/pending?limit=5');
      return data.data as { data: PendingCreator[]; meta: { total: number } };
    },
  });

  const {
    data: reports,
    isError: reportsError,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ['admin-reports-preview'],
    queryFn: async () => {
      const { data } = await api.get('/admin/reports?limit=5&status=pending');
      return data.data as { data: { id: string; reason: string; createdAt: string }[] };
    },
  });

  const {
    data: fraudAlerts,
    isError: fraudError,
    refetch: refetchFraud,
  } = useQuery({
    queryKey: ['admin-fraud-preview'],
    queryFn: async () => {
      const { data } = await api.get<{ data: FraudAlertPreview[] }>('/admin/fraud/alerts?status=open&limit=5');
      return data.data ?? [];
    },
  });

  const attentionQueue = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    for (const alert of fraudAlerts ?? []) {
      const { tone, label } = fraudTone(alert.riskScore);
      items.push({
        id: `fraud-${alert.id}`,
        kind: 'fraud',
        label: `Fraud signal — ${alert.signal.replace(/_/g, ' ')}`,
        detail: `Risk score ${alert.riskScore}`,
        href: '/fraud',
        severity: alert.riskScore,
        tone,
        toneLabel: label,
        createdAt: alert.createdAt,
      });
    }

    for (const report of reports?.data ?? []) {
      items.push({
        id: `report-${report.id}`,
        kind: 'report',
        label: `Report #${report.id.slice(0, 8)}…`,
        detail: report.reason,
        href: `/reports/${report.id}`,
        severity: 60,
        tone: 'warning',
        toneLabel: 'report',
        createdAt: report.createdAt,
      });
    }

    for (const creator of pending?.data ?? []) {
      items.push({
        id: `approval-${creator.id}`,
        kind: 'approval',
        label: creator.displayName || creator.username,
        detail: 'Creator approval requested',
        href: `/users/${creator.id}`,
        severity: 40,
        tone: 'primary',
        toneLabel: 'approval',
        createdAt: creator.creatorRequestedAt ?? '',
      });
    }

    return items
      .sort((a, b) => b.severity - a.severity || a.createdAt.localeCompare(b.createdAt))
      .slice(0, 8);
  }, [fraudAlerts, reports, pending]);

  const {
    data: kpi,
    isError: kpiError,
    refetch: refetchKpi,
  } = useQuery<PlatformKpiDashboard>({
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

  if (statsError) {
    return (
      <div className="glass-panel flex flex-col items-center rounded-xl px-6 py-12 text-center">
        <p className="text-error">Failed to load dashboard stats.</p>
        <button
          type="button"
          onClick={() => refetchStats()}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const secondaryError = pendingError || reportsError || fraudError || kpiError;
  const churn = kpi?.churn ? churnStatus(kpi.churn.churnRate) : null;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform overview" />
      {secondaryError ? (
        <div className="glass-panel mb-6 flex items-center justify-between rounded-xl px-4 py-3">
          <p className="text-sm text-error">Some dashboard data failed to load — figures below may be incomplete.</p>
          <button
            type="button"
            onClick={() => {
              void refetchPending();
              void refetchReports();
              void refetchFraud();
              void refetchKpi();
            }}
            className="text-sm text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : null}
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

      <div className="mb-10">
        <AlertStrip
          items={attentionQueue.map((item) => ({
            id: item.id,
            label: item.label,
            detail: item.detail,
            href: item.href,
            tone: item.tone,
            toneLabel: item.toneLabel,
          }))}
          linkComponent={AttentionLink}
        />
      </div>

      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        <div className="glass-panel flex flex-col gap-3 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-on-surface-variant">30-day churn</span>
            {churn ? <StatusPill tone={churn.tone} label={churn.label} /> : null}
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
                  <StatusPill tone={ENGAGEMENT_LABEL_TONE[u.label]} label={u.label} />
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
