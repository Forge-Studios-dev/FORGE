'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { Notification } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { ListSkeleton } from '@/components/LoadingSkeleton';
import { useAuth } from '@/lib/auth';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { isGuest } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    enabled: !isGuest,
    queryFn: async () => {
      const { data } = await api.get('/notifications');
      return data.data as Notification[];
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
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

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <PageHeader title="Notifications" subtitle="Creator status, uploads, and live session updates" />

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
      ) : !data?.length ? (
        <EmptyState
          icon="notifications"
          title="No notifications yet"
          description="When something needs your attention, it will show up here."
        />
      ) : (
        <ul className="space-y-3">
          {data.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => markRead.mutate(n.id)}
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
      )}
    </main>
  );
}
