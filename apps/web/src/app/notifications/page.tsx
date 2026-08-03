'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { EmptyState, Icon, ListSkeleton, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { Notification } from '@/types';
import { useAuth } from '@/lib/auth';
import { CATEGORY_LABEL, notificationMeta, type NotificationCategory } from '@/lib/notification-category';
import { notificationHref } from '@/lib/notification-href';

type NotificationsPage = {
  data: Notification[];
  meta: { cursor: string | null; hasMore: boolean };
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { isGuest } = useAuth();
  const [loadingMore, setLoadingMore] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);

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
        <PageHeader title="Notifications" subtitle="Uploads, live streams, comments, and channel updates" />
        <EmptyState
          icon="login"
          title="Sign in to see notifications"
          description="Get updates when channels you subscribe to upload or go live."
          action={{ label: 'Sign in', href: '/login?next=/notifications' }}
        />
      </main>
    );
  }

  const items = data?.data ?? [];

  const presentCategories = (Object.keys(CATEGORY_LABEL) as NotificationCategory[]).filter((cat) =>
    items.some((n) => notificationMeta(n.type).category === cat),
  );
  const visibleItems = items.filter((n) => {
    if (unreadOnly && n.readAt) return false;
    if (categoryFilter === 'all') return true;
    return notificationMeta(n.type).category === categoryFilter;
  });

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Notifications" subtitle="Uploads, live streams, comments, and channel updates" />
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="rounded border-outline-variant"
            />
            Unread only
          </label>
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
          {presentCategories.length > 1 && (
            <div className="hide-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  categoryFilter === 'all'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                All
              </button>
              {presentCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                    categoryFilter === cat
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {CATEGORY_LABEL[cat]}
                </button>
              ))}
            </div>
          )}

          {!visibleItems.length ? (
            <p className="py-8 text-center text-sm text-on-surface-variant">
              {unreadOnly
                ? 'No unread notifications.'
                : categoryFilter === 'all'
                  ? 'No notifications in this view.'
                  : `No ${CATEGORY_LABEL[categoryFilter as NotificationCategory]?.toLowerCase()} notifications.`}
            </p>
          ) : (
            <ul className="space-y-3">
              {visibleItems.map((n) => {
                const meta = notificationMeta(n.type);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.readAt) markRead.mutate(n.id);
                        const href = notificationHref(n.type, n.metadata);
                        if (href) router.push(href);
                      }}
                      disabled={markRead.isPending}
                      className={`glass-panel w-full rounded-xl p-4 text-left transition hover:border-primary/30 ${
                        n.readAt ? 'opacity-70' : 'border-primary/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.className}`}
                            aria-hidden
                          >
                            <Icon name={meta.icon} className="text-lg" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-on-surface">{n.title}</p>
                            {n.body ? <p className="mt-1 text-sm text-on-surface-variant">{n.body}</p> : null}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-outline">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
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
