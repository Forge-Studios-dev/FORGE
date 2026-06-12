'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@forge/design-system';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Channel = {
  id: string;
  name: string;
  slug: string;
  type: string;
};

export default function StudioCommunityPage() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['studio-community', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data: res } = await api.get<{
        data: { community: { id: string } | null; channels: Channel[] };
      }>(`/communities/${user!.id}`);
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; type: string }) => {
      await api.post('/creators/me/channels', payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studio-community', user?.id] }),
  });

  if (!isCreator) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <PageHeader title="Community channels" subtitle="Manage your creator community rooms" />

      <section className="glass-panel mb-6 space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">Add channel</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const name = String(fd.get('name') ?? '').trim();
            const type = String(fd.get('type') ?? 'public');
            if (!name) return;
            createMutation.mutate({ name, type });
            e.currentTarget.reset();
          }}
        >
          <input
            name="name"
            placeholder="Channel name"
            className="min-w-[160px] flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          />
          <select
            name="type"
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          >
            <option value="public">Public</option>
            <option value="subscribers">Members only</option>
            <option value="invite">Invite only</option>
          </select>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-40"
          >
            Create
          </button>
        </form>
      </section>

      <ul className="space-y-2">
        {(data?.channels ?? []).map((ch) => (
          <li key={ch.id} className="glass-panel flex items-center justify-between rounded-xl p-4">
            <div>
              <p className="font-medium">{ch.name}</p>
              <p className="text-xs capitalize text-on-surface-variant">{ch.type}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-on-surface-variant">#{ch.slug}</span>
              <Link
                href={`/community/${user!.id}?channel=${ch.id}`}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Moderate
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <Link href="/studio" className="mt-8 inline-block text-sm text-primary hover:underline">
        ← Back to Studio
      </Link>
    </main>
  );
}
