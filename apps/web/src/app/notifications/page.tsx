'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Notification } from '@/types';

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications');
      return data.data as Notification[];
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-gray-400 mt-2">Updates about your creator status, uploads, and live sessions.</p>

        <div className="mt-8 space-y-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass rounded-xl border border-white/10 p-4 animate-pulse h-20" />
            ))
          ) : data?.length ? (
            data.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead.mutate(n.id)}
                disabled={markRead.isPending}
                className={`w-full text-left glass rounded-xl border border-white/10 p-4 hover:bg-white/5 transition ${
                  n.readAt ? 'opacity-75' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{n.title}</p>
                    {n.body ? <p className="text-sm text-gray-400 mt-1">{n.body}</p> : null}
                  </div>
                  <span className="text-xs text-gray-500">{new Date(n.createdAt).toLocaleString()}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="glass rounded-xl border border-white/10 p-6">
              <p className="text-gray-400">No notifications yet.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

