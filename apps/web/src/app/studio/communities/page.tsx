'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button, EmptyState, Input, PageHeader, StatusPill } from '@forge/design-system';
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
      <main className="space-y-6">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Communities"
        subtitle="Create homes for members, track health, and jump into moderation or mentorship."
      />

      <section className="glass-panel space-y-3 rounded-2xl p-6">
        <h2 className="font-label-caps text-outline">New community</h2>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Community name" />
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="URL slug (optional)"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
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
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="paid">Paid members only</option>
            <option value="invite">Invite only</option>
          </select>
        </div>
        <Button
          disabled={!name.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          Create community
        </Button>
      </section>

      {(brands ?? []).length > 0 ? (
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
        >
          <option value="">All brands</option>
          {(brands ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      ) : null}

      {filteredCommunities.length === 0 ? (
        <EmptyState
          icon="hub"
          title="No communities yet"
          description="Create your first community to host rooms, events, channel points, and mentorship."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredCommunities.map((c) => (
            <article key={c.id} className="glass-panel rounded-2xl p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="text-xs text-on-surface-variant">/{c.slug}</p>
                </div>
                <StatusPill tone="neutral" label={c.visibility} />
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link href={`/studio/communities/${c.id}`} className="text-primary hover:underline">
                  Manage
                </Link>
                <Link href={`/studio/moderation/${c.id}`} className="text-on-surface-variant hover:underline">
                  Moderation
                </Link>
                <Link href="/studio/channel-points" className="text-on-surface-variant hover:underline">
                  Points
                </Link>
                <Link href="/studio/mentorship" className="text-on-surface-variant hover:underline">
                  Mentorship
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
