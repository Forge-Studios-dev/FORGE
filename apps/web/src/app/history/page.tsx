'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState, FeedGridSkeleton, Icon, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Video } from '@/types';
import { FeedCard } from '@/components/FeedCard/FeedCard';

export default function HistoryPage() {
  const qc = useQueryClient();
  const { user, isGuest } = useAuth();
  const [query, setQuery] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['watch-history', 'all', user?.id],
    enabled: !isGuest && !!user,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { data: { video: Video; progressSeconds: number }[] };
      }>('/users/me/watch-history?limit=50');
      return data.data.data.map((row) => ({
        ...row.video,
        viewerProgressSeconds: row.progressSeconds,
      }));
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete('/users/me/watch-history'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['watch-history'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (videoId: string) => api.delete(`/users/me/watch-history/${videoId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['watch-history'] });
    },
  });

  const filtered = useMemo(() => {
    if (!data?.length) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((v) => {
      const title = v.title?.toLowerCase() ?? '';
      const channel = v.user?.displayName?.toLowerCase() ?? '';
      const username = v.user?.username?.toLowerCase() ?? '';
      return title.includes(q) || channel.includes(q) || username.includes(q);
    });
  }, [data, query]);

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Watch history" subtitle="Videos you've watched" />
        {!isGuest ? (
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/profile/settings#privacy"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Pause watch history
            </Link>
            {!!data?.length ? (
              <button
                type="button"
                disabled={clearMutation.isPending}
                onClick={() => {
                  if (window.confirm('Clear your entire watch history?')) {
                    clearMutation.mutate();
                  }
                }}
                className="text-sm font-semibold text-on-surface-variant hover:text-error disabled:opacity-50"
              >
                {clearMutation.isPending ? 'Clearing…' : 'Clear all watch history'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isGuest ? (
        <EmptyState
          icon="history"
          title="Keep track of what you watch"
          description="Watch history isn't available when you're signed out."
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
          description="Videos you watch will show up here."
          action={{ label: 'Browse videos', href: '/' }}
        />
      ) : (
        <>
          <div className="relative mb-6 max-w-md">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search watch history"
              className="pl-10"
              aria-label="Search watch history"
            />
          </div>
          {!filtered.length ? (
            <EmptyState
              icon="search_off"
              title="No matches"
              description={`Nothing in your history matched “${query.trim()}”.`}
              action={{ label: 'Clear search', href: '/history' }}
              onAction={() => setQuery('')}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((video) => (
                <div key={video.id} className="relative">
                  <FeedCard video={video} />
                  <button
                    type="button"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(video.id)}
                    className="absolute right-2 top-2 z-20 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-medium text-on-surface-variant shadow-sm hover:text-error disabled:opacity-50"
                    aria-label={`Remove ${video.title} from watch history`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
