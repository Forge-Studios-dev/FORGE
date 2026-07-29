'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Brand } from '@/types/community';

export default function StudioBrandsPage() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => setStatusMsg(''), 3000);
  };

  const { data: brands } = useQuery({
    queryKey: ['studio-brands', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: Brand[] }>('/creators/me/brands');
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/creators/me/brands', {
        name: name.trim(),
        slug: slug.trim() || undefined,
      });
    },
    onSuccess: () => {
      setName('');
      setSlug('');
      void qc.invalidateQueries({ queryKey: ['studio-brands', user?.id] });
      void qc.invalidateQueries({ queryKey: ['my-brands', user?.id] });
      showStatus('Brand created');
    },
    onError: () => showStatus('Failed to create brand'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ brandId, payload }: { brandId: string; payload: { name: string; slug?: string } }) => {
      await api.patch(`/creators/me/brands/${brandId}`, payload);
    },
    onSuccess: () => {
      setEditingId(null);
      void qc.invalidateQueries({ queryKey: ['studio-brands', user?.id] });
      void qc.invalidateQueries({ queryKey: ['my-brands', user?.id] });
      showStatus('Brand updated');
    },
    onError: () => showStatus('Failed to update brand'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (brandId: string) => {
      await api.delete(`/creators/me/brands/${brandId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['studio-brands', user?.id] });
      void qc.invalidateQueries({ queryKey: ['my-brands', user?.id] });
      showStatus('Brand deleted');
    },
    onError: () => showStatus('Failed to delete brand'),
  });

  if (!isCreator) {
    return (
      <main className="space-y-6">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader title="Brands" subtitle="Organize multiple communities under brand identities" />

      {statusMsg ? (
        <p className="mb-4 rounded-lg bg-primary/10 px-4 py-2 text-sm text-primary">{statusMsg}</p>
      ) : null}

      <section className="glass-panel mb-8 space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">New brand</h2>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name" />
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="URL slug (optional)" />
        <Button
          disabled={!name.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          Create brand
        </Button>
      </section>

      <ul className="space-y-2">
        {(brands ?? []).map((b) => (
          <li key={b.id} className="glass-panel rounded-xl p-4">
            {editingId === b.id ? (
              <div className="space-y-2">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} placeholder="Slug" />
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      updateMutation.mutate({
                        brandId: b.id,
                        payload: { name: editName.trim(), slug: editSlug.trim() || undefined },
                      })
                    }
                    disabled={updateMutation.isPending || !editName.trim()}
                  >
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-on-surface-variant">/{b.slug}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="text-xs"
                    onClick={() => {
                      setEditingId(b.id);
                      setEditName(b.name);
                      setEditSlug(b.slug);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs text-error"
                    onClick={() => {
                      if (window.confirm('Delete this brand? Communities will be unlinked.')) {
                        deleteMutation.mutate(b.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Link href="/studio" className="mt-8 inline-block text-sm text-primary hover:underline">
        ← Back to Studio
      </Link>
    </main>
  );
}
