'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

import type { Brand, Community } from '@/types/community';

export default function StudioCommunitiesPage() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [brandId, setBrandId] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [brandFilter, setBrandFilter] = useState('');

  const { data: brands } = useQuery({
    queryKey: ['my-brands', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: Brand[] }>('/creators/me/brands');
      return data.data;
    },
  });

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
        brandId: brandId || undefined,
        visibility,
      });
    },
    onSuccess: () => {
      setName('');
      setSlug('');
      setBrandId('');
      void qc.invalidateQueries({ queryKey: ['studio-communities', user?.id] });
    },
  });

  const filteredCommunities = (communities ?? []).filter(
    (c) => !brandFilter || c.brandId === brandFilter,
  );

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
        <select
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
        >
          <option value="">No brand</option>
          {(brands ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
          <option value="paid">Paid members only</option>
          <option value="invite">Invite only</option>
        </select>
        <Button
          disabled={!name.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          Create community
        </Button>
      </section>

      {(brands ?? []).length > 0 ? (
        <div className="mb-4">
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          >
            <option value="">All brands</option>
            {(brands ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <ul className="space-y-2">
        {filteredCommunities.length === 0 ? (
          <li className="glass-panel rounded-xl p-4 text-sm text-on-surface-variant">
            No communities yet. Create one above.
          </li>
        ) : (
          filteredCommunities.map((c) => (
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
          ))
        )}
      </ul>

      <Link href="/studio" className="mt-8 inline-block text-sm text-primary hover:underline">
        ← Back to Studio
      </Link>
    </main>
  );
}
