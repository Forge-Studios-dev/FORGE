'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@forge/design-system';
import { api } from '@/lib/api';

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  readAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

/** Same-origin admin deep link for inbox items (not the consumer web admin URL). */
export function adminNotificationHref(n: Pick<AdminNotification, 'type' | 'metadata'>): string {
  if (n.type === 'content_scan_held') {
    const videoId = typeof n.metadata?.videoId === 'string' ? n.metadata.videoId : null;
    const q = new URLSearchParams({ moderationStatus: 'held' });
    if (videoId) q.set('videoId', videoId);
    return `/content?${q.toString()}`;
  }
  return '/content?moderationStatus=held';
}

/**
 * Compact admin inbox — platform admins receive content_scan_held on the same
 * user account used for consumer apps.
 */
export function AdminNotificationsBell() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const { data: unread = 0 } = useQuery({
    queryKey: ['admin-notifications-unread'],
    queryFn: async () => {
      const { data } = await api.get<{ data: { count: number } }>('/notifications/unread-count');
      return data.data.count ?? 0;
    },
    refetchInterval: 60_000,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin-notifications-preview'],
    enabled: open,
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: AdminNotification[] } }>(
        '/notifications?limit=8',
      );
      return data.data.data ?? [];
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-notifications-preview'] });
      void qc.invalidateQueries({ queryKey: ['admin-notifications-unread'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-notifications-preview'] });
      void qc.invalidateQueries({ queryKey: ['admin-notifications-unread'] });
    },
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest/50"
      >
        <Icon name="notifications" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-xs font-bold leading-none text-on-error">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={menuId}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-low shadow-lg sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-outline-variant/20 px-4 py-3">
            <span className="text-sm font-semibold text-on-surface">Notifications</span>
            <div className="flex items-center gap-3">
              {unread > 0 ? (
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
                href="/content?moderationStatus=held"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                Held videos
              </Link>
            </div>
          </div>
          {isLoading ? (
            <p className="px-4 py-6 text-sm text-on-surface-variant">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-on-surface-variant">No notifications yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`w-full border-b border-outline-variant/10 px-4 py-3 text-left hover:bg-surface-container-high/40 ${
                      n.readAt ? 'opacity-70' : ''
                    }`}
                    onClick={() => {
                      if (!n.readAt) markRead.mutate(n.id);
                      navigate(adminNotificationHref(n));
                    }}
                  >
                    <p className="text-sm font-semibold text-on-surface">{n.title}</p>
                    {n.body ? (
                      <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">{n.body}</p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
