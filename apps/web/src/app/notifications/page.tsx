'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { Notification } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { ListSkeleton } from '@/components/LoadingSkeleton';
import { useAuth } from '@/lib/auth';

type NotificationsPage = {
  data: Notification[];
  meta: { cursor: string | null; hasMore: boolean };
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { isGuest } = useAuth();
  const [loadingMore, setLoadingMore] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    enabled: !isGuest,
    queryFn: async () => {
      const { data } = await api.get<{ data: NotificationsPage }>('/notifications?limit=30');
      return data.data;
    },
  });

  const loadMore = useCallback(async () => {
    if (!data?.meta.hasMore || !data.meta.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data: next } = await api.get<{ data: NotificationsPage }>(
        `/notifications?limit=30&cursor=${encodeURIComponent(data.meta.cursor)}`,
      );
      qc.setQueryData(['notifications'], {
        data: [...(data.data ?? []), ...next.data.data],
        meta: next.data.meta,
      });
    } finally {
      setLoadingMore(false);
    }
  }, [data, loadingMore, qc]);

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ['notifications'] });
    void qc.invalidateQueries({ queryKey: ['notifications-unread'] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: invalidateAll,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: invalidateAll,
  });

  if (isGuest) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
        <PageHeader title="Notifications" subtitle="Creator status, uploads, and live session updates" />
        <EmptyState
          icon="login"
          title="Sign in to see notifications"
          description="Get updates on creator approval, uploads, and live sessions."
          action={{ label: 'Sign in', href: '/login?next=/notifications' }}
        />
      </main>
    );
  }

  const items = data?.data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Notifications" subtitle="Creator status, uploads, and live session updates" />
        {items.some((n) => !n.readAt) && (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-sm font-semibold text-primary hover:underline disabled:opacity-50"
          >
            Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : isError ? (
        <EmptyState
          icon="error"
          title="Couldn't load notifications"
          description="Check your connection and try again."
          action={{ label: 'Retry', href: '/notifications' }}
          onAction={() => refetch()}
        />
      ) : !items.length ? (
        <EmptyState
          icon="notifications"
          title="No notifications yet"
          description="When something needs your attention, it will show up here."
        />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.readAt) markRead.mutate(n.id);
                  }}
                  disabled={markRead.isPending}
                  className={`glass-panel w-full rounded-xl p-4 text-left transition hover:border-primary/30 ${
                    n.readAt ? 'opacity-70' : 'border-primary/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-on-surface">{n.title}</p>
                      {n.body ? <p className="mt-1 text-sm text-on-surface-variant">{n.body}</p> : null}
                    </div>
                    <span className="shrink-0 text-xs text-outline">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {data?.meta.hasMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="mt-6 text-sm font-semibold text-primary hover:underline disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </main>
  );
}
