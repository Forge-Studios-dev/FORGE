'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@forge/design-system/client';
import { EmptyState, FeedGridSkeleton, Icon, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Video } from '@/types';
import { FeedCard } from '@/components/FeedCard/FeedCard';

export default function DislikedVideosPage() {
  const qc = useQueryClient();
  const { user, isGuest } = useAuth();
  const [query, setQuery] = useState('');
  const [clearOpen, setClearOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['disliked-videos', user?.id],
    enabled: !isGuest && !!user,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { data: Video[]; meta: { total: number } };
      }>('/me/disliked-videos?limit=100');
      return data.data.data;
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete('/me/disliked-videos'),
    onSuccess: () => {
      setClearOpen(false);
      void qc.invalidateQueries({ queryKey: ['disliked-videos'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (videoId: string) => api.delete(`/videos/${videoId}/dislike`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['disliked-videos'] });
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
        <PageHeader
          title="Disliked videos"
          subtitle="Private list of videos you’ve disliked"
        />
        {!isGuest && !!data?.length ? (
          <button
            type="button"
            disabled={clearMutation.isPending}
            onClick={() => setClearOpen(true)}
            className="text-sm font-semibold text-on-surface-variant hover:text-error disabled:opacity-50"
          >
            {clearMutation.isPending ? 'Clearing…' : 'Clear all'}
          </button>
        ) : null}
      </div>

      <ConfirmDialog
        open={clearOpen}
        title="Clear disliked videos?"
        description="This removes your dislike from every video on this list. You can’t undo this."
        confirmLabel="Clear all"
        onConfirm={() => clearMutation.mutate()}
        onCancel={() => setClearOpen(false)}
        loading={clearMutation.isPending}
      />

      {isGuest ? (
        <EmptyState
          icon="thumb_down"
          title="Sign in for Disliked videos"
          description="Videos you dislike are saved privately on your account."
          action={{ label: 'Sign in', href: '/login?next=/library/disliked' }}
        />
      ) : isLoading ? (
        <FeedGridSkeleton count={8} />
      ) : isError ? (
        <EmptyState
          icon="error"
          title="Couldn't load disliked videos"
          description="Check your connection and try again."
          action={{ label: 'Retry', href: '/library/disliked' }}
          onAction={() => refetch()}
        />
      ) : !data?.length ? (
        <EmptyState
          icon="thumb_down"
          title="No disliked videos"
          description="Videos you dislike will show up here. This list is private."
          action={{ label: 'Browse', href: '/' }}
        />
      ) : (
        <>
          {data.length > 3 ? (
            <div className="relative mb-6 max-w-md">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search disliked videos"
                className="pl-10"
                aria-label="Search disliked videos"
              />
            </div>
          ) : null}
          {!filtered.length ? (
            <EmptyState
              icon="search_off"
              title="No matches"
              description={`Nothing matched “${query.trim()}”.`}
              action={{ label: 'Clear search', href: '/library/disliked' }}
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
                    aria-label={`Remove dislike from ${video.title}`}
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
