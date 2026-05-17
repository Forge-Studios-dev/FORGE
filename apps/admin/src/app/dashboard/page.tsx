'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@forge/design-system';
import { AdminStatCard } from '@/components/AdminStatCard';
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

  if (statsLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass-panel h-28 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform overview" />
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard label="Total users" value={stats?.userCount ?? 0} icon="group" href="/users" />
        <AdminStatCard label="Total videos" value={stats?.videoCount ?? 0} icon="video_library" href="/content" />
        <AdminStatCard
          label="Published videos"
          value={stats?.readyVideoCount ?? 0}
          icon="visibility"
          href="/content"
        />
        <AdminStatCard
          label="Pending approvals"
          value={pending?.meta?.total ?? pending?.data?.length ?? 0}
          icon="verified"
          href="/creator-approvals"
        />
      </div>

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
