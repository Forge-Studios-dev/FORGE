'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@forge/design-system';
import { api } from '@/lib/api';
import { Notification } from '@/types';
import { notificationHref } from '@/lib/notification-href';
import { notificationMeta } from '@/lib/notification-category';
import { timeAgo } from '@/lib/utils';

type Props = {
  unreadCount: number;
};

export function NotificationsMenu({ unreadCount }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const rootRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['notifications', 'preview'],
    enabled: open,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { data: Notification[]; meta: { cursor: string | null; hasMore: boolean } };
      }>('/notifications?limit=8');
      return data.data.data ?? [];
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['notifications-unread'] });
      void qc.invalidateQueries({ queryKey: ['notifications', 'preview'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['notifications-unread'] });
      void qc.invalidateQueries({ queryKey: ['notifications', 'preview'] });
    },
  });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onToggle = () => setOpen(el.open);
    el.addEventListener('toggle', onToggle);
    return () => el.removeEventListener('toggle', onToggle);
  }, []);

  const openItem = (n: Notification) => {
    if (!n.readAt) markRead.mutate(n.id);
    const href = notificationHref(n.type, n.metadata) ?? '/notifications';
    rootRef.current?.removeAttribute('open');
    router.push(href);
  };

  return (
    <details ref={rootRef} className="relative">
      <summary
        className="relative flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest/50 [&::-webkit-details-marker]:hidden"
        aria-label="Notifications"
      >
        <Icon name="notifications" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-on-error">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-high shadow-lg sm:w-96">
        <div className="flex items-center justify-between gap-2 border-b border-outline-variant/20 px-4 py-3">
          <span className="text-sm font-semibold text-on-surface">Notifications</span>
          <div className="flex items-center gap-3">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs font-medium text-on-surface-variant hover:text-primary disabled:opacity-50"
              >
                Mark all read
              </button>
            ) : null}
            <Link
              href="/notifications"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => rootRef.current?.removeAttribute('open')}
            >
              See all
            </Link>
          </div>
        </div>
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-on-surface-variant">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-on-surface-variant">No notifications yet.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {items.map((n) => {
              const meta = notificationMeta(n.type);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-container-highest ${
                      n.readAt ? '' : 'bg-primary/5'
                    }`}
                  >
                    <Icon name={meta.icon} className="mt-0.5 shrink-0 text-base text-outline" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-on-surface">{n.title}</span>
                      {n.body ? (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-on-surface-variant">
                          {n.body}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-[11px] text-outline">
                        {timeAgo(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
