'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Icon, PageHeader } from '@forge/design-system';
import { getMyVideos } from '@/lib/creator-studio';
import { useAuth } from '@/lib/auth';
import { formatCount, timeAgo } from '@/lib/utils';

export default function StudioVideosPage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['studio-videos', user?.id],
    queryFn: () => getMyVideos(user?.id),
    enabled: !!user?.id,
  });

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader title="Your videos" subtitle="Manage uploads and processing status" />
      <Link
        href="/upload"
        className="primary-button mb-6 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-on-primary"
      >
        <Icon name="add" />
        New upload
      </Link>

      {isLoading && <p className="text-on-surface-variant">Loading videos…</p>}
      {isError && <p className="text-error">Failed to load videos.</p>}
      {data?.length === 0 && !isLoading && (
        <div className="glass-panel rounded-xl p-10 text-center">
          <Icon name="video_library" className="mb-4 text-4xl text-outline" />
          <p className="text-on-surface-variant">No videos yet. Upload your first lesson.</p>
        </div>
      )}
      <ul className="space-y-3">
        {data?.map((video) => (
          <li key={video.id} className="glass-panel flex items-center justify-between rounded-xl p-4">
            <div>
              <p className="font-medium">{video.title}</p>
              <p className="text-sm text-on-surface-variant">
                {video.status} · {formatCount(video.viewCount)} views · {timeAgo(video.createdAt)}
              </p>
            </div>
            <Link href={`/watch/${video.id}`} className="text-sm text-primary hover:underline">
              View
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
