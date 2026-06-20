'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Subscriber = {
  id: string;
  userId: string;
  username?: string;
  displayName?: string;
  tierName?: string;
  status: string;
  source: string;
  startsAt: string;
  expiresAt?: string | null;
};

export default function StudioSubscribersPage() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();

  const { data: subscribers, isLoading } = useQuery({
    queryKey: ['studio-subscribers', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: Subscriber[] }>('/creators/me/subscribers');
      return data.data;
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      await api.post(`/creators/me/subscribers/${subscriptionId}/suspend`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studio-subscribers', user?.id] }),
  });

  if (!isCreator) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader title="Subscribers" subtitle="Manage your active members and export data" />

      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => {
            window.open(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/creators/me/subscribers/export`, '_blank');
          }}
        >
          Export CSV
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {(subscribers ?? []).map((s) => (
            <li key={s.id} className="glass-panel flex items-center justify-between rounded-xl p-4">
              <div>
                <p className="font-medium">{s.displayName ?? s.username ?? s.userId}</p>
                <p className="text-xs text-on-surface-variant">
                  {s.tierName} · {s.source} · {s.status}
                </p>
              </div>
              <Button
                variant="ghost"
                className="text-xs text-error"
                disabled={suspendMutation.isPending}
                onClick={() => {
                  if (window.confirm('Suspend this membership?')) {
                    suspendMutation.mutate(s.id);
                  }
                }}
              >
                Suspend
              </Button>
            </li>
          ))}
          {(subscribers ?? []).length === 0 ? (
            <p className="text-sm text-on-surface-variant">No subscribers yet.</p>
          ) : null}
        </ul>
      )}

      <Link href="/studio" className="mt-8 inline-block text-sm text-primary hover:underline">
        ← Back to Studio
      </Link>
    </main>
  );
}
