'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader, StatCard } from '@forge/design-system';
import { api } from '@/lib/api';

export default function AnalyticsPage() {
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await api.get('/admin/stats');
      return data.data as { userCount: number; videoCount: number; readyVideoCount: number };
    },
  });

  const {
    data: analytics,
    isLoading: analyticsLoading,
    isError: analyticsError,
    refetch: refetchAnalytics,
  } = useQuery({
    queryKey: ['admin-analytics-summary'],
    queryFn: async () => {
      const { data } = await api.get('/admin/analytics/summary');
      return data.data as {
        totalEvents: number;
        byEvent: { eventName: string; count: string }[];
      };
    },
  });

  const loading = statsLoading || analyticsLoading;
  const hasError = statsError || analyticsError;
  const chartData =
    analytics?.byEvent?.map((row) => ({
      name: row.eventName,
      count: Number(row.count),
    })) ?? [];

  return (
    <section>
      <PageHeader title="Analytics" subtitle="Platform metrics (last 7 days)" />
      {loading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : hasError ? (
        <div className="glass-panel flex flex-col items-center rounded-xl px-6 py-12 text-center">
          <p className="text-error">Failed to load analytics.</p>
          <button
            type="button"
            onClick={() => {
              void refetchStats();
              void refetchAnalytics();
            }}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total users" value={stats?.userCount ?? 0} icon="group" />
            <StatCard label="Total videos" value={stats?.videoCount ?? 0} icon="video_library" />
            <StatCard label="Published" value={stats?.readyVideoCount ?? 0} icon="visibility" />
            <StatCard
              label="Events ingested"
              value={analytics?.totalEvents ?? 0}
              icon="analytics"
              hint="Client analytics events"
            />
          </div>
          <div className="glass-panel rounded-xl p-6">
            <h2 className="font-display-forge mb-4 text-lg font-semibold">Events by name</h2>
            {chartData.length ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">No analytics events recorded yet.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
