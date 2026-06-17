'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@forge/design-system';
import { EmptyState } from '@/components/EmptyState';
import { StatCardsSkeleton } from '@/components/LoadingSkeleton';
import { getMyVideos } from '@/lib/creator-studio';
import { useAuth } from '@/lib/auth';
import { formatCount } from '@/lib/utils';
import { api } from '@/lib/api';

export default function StudioAnalyticsPage() {
  const { user } = useAuth();
  const { data: videos, isLoading, isError } = useQuery({
    queryKey: ['studio-analytics', user?.id],
    queryFn: async () => {
      const all = await getMyVideos(user?.id);
      return all.filter((v) => v.status === 'ready');
    },
    enabled: !!user?.id,
  });

  const { data: subscriberStats } = useQuery({
    queryKey: ['subscriber-analytics', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { active: number; trial: number; mrrCents: number; canceled: number };
      }>('/creators/me/subscribers/analytics');
      return data.data;
    },
  });

  const totalViews = videos?.reduce((sum, v) => sum + (v.viewCount ?? 0), 0) ?? 0;
  const totalLikes = videos?.reduce((sum, v) => sum + (v.likeCount ?? 0), 0) ?? 0;
  const readyCount = videos?.filter((v) => v.status === 'ready').length ?? 0;

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader title="Analytics" subtitle="Channel performance overview" />

      {subscriberStats ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          <article className="glass-panel rounded-xl p-5">
            <p className="text-sm text-on-surface-variant">Active members</p>
            <p className="font-display-forge mt-1 text-2xl font-bold text-primary">
              {formatCount(subscriberStats.active)}
            </p>
          </article>
          <article className="glass-panel rounded-xl p-5">
            <p className="text-sm text-on-surface-variant">Trials</p>
            <p className="font-display-forge mt-1 text-2xl font-bold">{subscriberStats.trial}</p>
          </article>
          <article className="glass-panel rounded-xl p-5">
            <p className="text-sm text-on-surface-variant">MRR</p>
            <p className="font-display-forge mt-1 text-2xl font-bold">
              ₹{(subscriberStats.mrrCents / 100).toFixed(0)}
            </p>
          </article>
          <article className="glass-panel rounded-xl p-5">
            <p className="text-sm text-on-surface-variant">Canceled</p>
            <p className="font-display-forge mt-1 text-2xl font-bold">{subscriberStats.canceled}</p>
          </article>
        </div>
      ) : null}

      {isLoading && <StatCardsSkeleton />}
      {isError && <p className="text-error">Failed to load analytics.</p>}

      {!isLoading && !isError && !videos?.length && (
        <EmptyState
          icon="analytics"
          title="No analytics yet"
          description="Upload lessons to start tracking views and engagement."
          action={{ label: 'Upload lesson', href: '/upload' }}
        />
      )}

      {videos && videos.length > 0 && (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <article className="glass-panel rounded-xl p-5">
              <p className="text-sm text-on-surface-variant">Total views</p>
              <p className="font-display-forge mt-1 text-2xl font-bold text-primary">{formatCount(totalViews)}</p>
            </article>
            <article className="glass-panel rounded-xl p-5">
              <p className="text-sm text-on-surface-variant">Total likes</p>
              <p className="font-display-forge mt-1 text-2xl font-bold text-secondary">{formatCount(totalLikes)}</p>
            </article>
            <article className="glass-panel rounded-xl p-5">
              <p className="text-sm text-on-surface-variant">Published</p>
              <p className="font-display-forge mt-1 text-2xl font-bold">{readyCount}</p>
            </article>
          </div>

          <Link
            href="/studio/analytics/details"
            className="mb-6 inline-block text-sm font-medium text-primary hover:underline"
          >
            View per-lesson breakdown →
          </Link>

          <ul className="space-y-2">
            {videos.slice(0, 5).map((v) => (
              <li
                key={v.id}
                className="glass-panel flex items-center justify-between rounded-lg px-4 py-3 text-sm"
              >
                <span className="truncate font-medium">{v.title}</span>
                <span className="shrink-0 text-primary">{formatCount(v.viewCount)} views</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
