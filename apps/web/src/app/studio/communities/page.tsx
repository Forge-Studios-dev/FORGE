'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Community = {
  id: string;
  name: string;
  slug: string;
  visibility: string;
};

export default function StudioCommunitiesPage() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const { data: communities } = useQuery({
    queryKey: ['studio-communities', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: Community[] }>(`/creators/${user!.id}/communities`);
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/creators/me/communities', {
        name: name.trim(),
        slug: slug.trim() || undefined,
      });
    },
    onSuccess: () => {
      setName('');
      setSlug('');
      void qc.invalidateQueries({ queryKey: ['studio-communities', user?.id] });
    },
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
      <PageHeader title="Communities" subtitle="Create and manage your creator communities" />

      <section className="glass-panel mb-8 space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">New community</h2>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Community name" />
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="URL slug (optional)"
        />
        <Button
          disabled={!name.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          Create community
        </Button>
      </section>

      <ul className="space-y-2">
        {(communities ?? []).map((c) => (
          <li key={c.id}>
            <Link
              href={`/studio/communities/${c.id}`}
              className="glass-panel flex items-center justify-between rounded-xl p-4 hover:border-primary/30"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs capitalize text-on-surface-variant">
                  /{c.slug} · {c.visibility}
                </p>
              </div>
              <span className="text-sm text-primary">Manage →</span>
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/studio" className="mt-8 inline-block text-sm text-primary hover:underline">
        ← Back to Studio
      </Link>
    </main>
  );
}
