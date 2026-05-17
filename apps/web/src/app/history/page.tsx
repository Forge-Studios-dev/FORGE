'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Video } from '@/types';
import { FeedCard } from '@/components/FeedCard/FeedCard';
import { EmptyState } from '@/components/EmptyState';
import { FeedGridSkeleton } from '@/components/LoadingSkeleton';

export default function HistoryPage() {
  const { user, isGuest } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['watch-history', 'all', user?.id],
    enabled: !isGuest && !!user,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { data: { video: Video; progressSeconds: number }[] };
      }>('/users/me/watch-history?limit=50');
      return data.data.data.map((row) => row.video);
    },
  });

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <PageHeader title="Watch history" subtitle="Lessons you've started or completed" />

      {isGuest ? (
        <EmptyState
          icon="history"
          title="Sign in required"
          description="Sign in to see your watch history."
          action={{ label: 'Sign in', href: '/login?next=/history' }}
        />
      ) : isLoading ? (
        <FeedGridSkeleton count={8} />
      ) : isError ? (
        <EmptyState
          icon="error"
          title="Couldn't load history"
          description="Check your connection and try again."
          action={{ label: 'Retry', href: '/history' }}
          onAction={() => refetch()}
        />
      ) : !data?.length ? (
        <EmptyState
          icon="history"
          title="No history yet"
          description="Browse the feed and start watching lessons."
          action={{ label: 'Discover skills', href: '/explore' }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((video) => (
            <FeedCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </main>
  );
}
