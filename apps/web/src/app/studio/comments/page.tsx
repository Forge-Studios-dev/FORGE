'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ListSkeleton, PageHeader } from '@forge/design-system';
import { getRecentCommentsOnMyVideos } from '@/lib/creator-studio';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/utils';

export default function StudioCommentsPage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['studio-comments', user?.id],
    queryFn: () => getRecentCommentsOnMyVideos(user?.id),
    enabled: !!user?.id,
  });

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader title="Comments" subtitle="Recent feedback on your lessons" />

      {isLoading && <ListSkeleton rows={4} />}
      {isError && <p className="text-error">Failed to load comments.</p>}

      {!isLoading && !isError && !data?.length && (
        <EmptyState
          icon="forum"
          title="No comments yet"
          description="When learners engage with your lessons, their comments will appear here."
          action={{ label: 'Upload a lesson', href: '/upload' }}
        />
      )}

      <ul className="space-y-3">
        {data?.map((c) => (
          <li key={c.id} className="glass-panel rounded-xl p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-outline">
              <Link href={`/watch/${c.videoId}`} className="text-primary hover:underline">
                {c.videoTitle}
              </Link>
              <span>·</span>
              <span>{timeAgo(c.createdAt)}</span>
            </div>
            <p className="text-sm text-on-surface">{c.content}</p>
            <p className="mt-2 text-xs text-on-surface-variant">
              @{c.user?.username ?? 'user'} · {c.user?.displayName ?? 'User'}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
