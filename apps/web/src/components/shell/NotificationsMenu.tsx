'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@forge/design-system';
import { api } from '@/lib/api';
import { Notification } from '@/types';
import { notificationHref } from '@/lib/notification-href';
import { notificationMeta } from '@/lib/notification-category';
import { timeAgo } from '@/lib/utils';
import { PopoverMenu } from '@/components/shell/PopoverMenu';

type Props = {
  unreadCount: number;
};

export function NotificationsMenu({ unreadCount }: Props) {
  const router = useRouter();
  const qc = useQueryClient();

  return (
    <PopoverMenu
      label="Notifications"
      align="right"
      panelRole="dialog"
      panelClassName="w-80 max-w-[calc(100vw-2rem)] p-0 sm:w-96"
      triggerClassName="relative flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest/50"
      trigger={
        <>
          <Icon name="notifications" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-xs font-bold leading-none text-on-error">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </>
      }
    >
      {(close) => (
        <NotificationsPanel
          unreadCount={unreadCount}
          onNavigate={(href) => {
            close();
            router.push(href);
          }}
          onClose={close}
          qc={qc}
        />
      )}
    </PopoverMenu>
  );
}

function NotificationsPanel({
  unreadCount,
  onNavigate,
  onClose,
  qc,
}: {
  unreadCount: number;
  onNavigate: (href: string) => void;
  onClose: () => void;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['notifications', 'preview'],
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

  const openItem = (n: Notification) => {
    if (!n.readAt) markRead.mutate(n.id);
    const href = notificationHref(n.type, n.metadata) ?? '/notifications';
    onNavigate(href);
  };

  return (
    <>
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
            onClick={onClose}
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
                    <span className="mt-1 block text-xs text-outline">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
