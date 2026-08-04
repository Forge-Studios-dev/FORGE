'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, PageHeader } from '@forge/design-system';
import { useAuth } from '@/lib/auth';
import { formatCount } from '@/lib/utils';
import { api } from '@/lib/api';

type TopVideo = {
  videoId: string;
  title: string;
  views: number;
  impressions: number;
  ctr: number | null;
  avgWatchPercent: number | null;
};

export default function StudioAnalyticsDetailsPage() {
  const { user, isCreator } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['studio-video-performance-top', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          periodDays: number;
          topVideos: TopVideo[];
        };
      }>('/analytics/studio/video-performance');
      return data.data;
    },
  });

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <PageHeader title="Video performance" subtitle="Creator access required." />
      </main>
    );
  }

  const videos = data?.topVideos ?? [];

  return (
    <main className="space-y-6">
      <Link href="/studio/analytics" className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Analytics
      </Link>
      <PageHeader
        title="Video performance"
        subtitle={`Top videos by views · last ${data?.periodDays ?? 28} days (impressions, CTR, avg watch %)`}
      />

      {isLoading && <p className="text-on-surface-variant">Loading…</p>}
      {isError && <p className="text-error">Failed to load video metrics.</p>}

      {!isLoading && !isError && !videos.length && (
        <EmptyState
          icon="analytics"
          title="No videos"
          description="Upload and publish videos to see impressions, CTR, and watch retention."
        />
      )}

      {videos.length > 0 ? (
        <div className="glass-panel rounded-xl p-6">
          <ul className="space-y-4">
            {videos.map((v) => (
              <li
                key={v.videoId}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20 pb-4 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/studio/videos/${v.videoId}`}
                    className="truncate font-medium text-on-surface hover:text-primary"
                  >
                    {v.title}
                  </Link>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-on-surface-variant">
                  <span>{formatCount(v.views)} views</span>
                  <span>{formatCount(v.impressions)} impressions</span>
                  <span>
                    CTR{' '}
                    {v.ctr != null ? `${Math.round(v.ctr * 1000) / 10}%` : '—'}
                  </span>
                  <span>
                    Watch {v.avgWatchPercent != null ? `${v.avgWatchPercent}%` : '—'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </main>
  );
}
