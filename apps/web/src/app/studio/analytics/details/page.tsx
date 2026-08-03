'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, PageHeader } from '@forge/design-system';
import { getMyVideos } from '@/lib/creator-studio';
import { useAuth } from '@/lib/auth';
import { formatCount } from '@/lib/utils';

export default function StudioAnalyticsDetailsPage() {
  const { user, isCreator } = useAuth();
  const { data: videos, isLoading, isError } = useQuery({
    queryKey: ['studio-analytics-videos', user?.id],
    queryFn: async () => {
      const all = await getMyVideos(user?.id);
      return all.filter((v) => v.status === 'ready');
    },
    enabled: !!user?.id && isCreator,
  });

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <PageHeader title="Video performance" subtitle="Creator access required." />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <Link href="/studio/analytics" className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Analytics
      </Link>
      <PageHeader title="Video performance" subtitle="Per-video metrics" />

      {isLoading && <p className="text-on-surface-variant">Loading…</p>}
      {isError && <p className="text-error">Failed to load video metrics.</p>}

      {!isLoading && !isError && !videos?.length && (
        <EmptyState icon="analytics" title="No videos" description="Upload videos to see per-video stats." />
      )}

      <div className="glass-panel rounded-xl p-6">
        <ul className="space-y-4">
          {videos?.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/20 pb-4 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{v.title}</p>
                <p className="text-xs text-outline">{v.status}</p>
              </div>
              <div className="flex gap-4 text-sm text-on-surface-variant">
                <span>{formatCount(v.viewCount)} views</span>
                <span>{formatCount(v.likeCount)} likes</span>
                <span>{formatCount(v.commentCount)} comments</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
