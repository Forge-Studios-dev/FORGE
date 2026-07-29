'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button, Input, PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SubscriptionTier } from '@/types';

type BundleItem = {
  id?: string;
  resourceType: string;
  resourceId?: string | null;
};

type Bundle = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  tierId: string;
  isActive: boolean;
  items: BundleItem[];
  tier?: { id: string; name: string; priceCents: number; currency: string; billingInterval: string };
};

const RESOURCE_TYPES = ['community', 'course', 'channel', 'video', 'stream', 'event', 'creator'];

export default function StudioBundlesPage() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tierId, setTierId] = useState('');
  const [resourceType, setResourceType] = useState('community');
  const [resourceId, setResourceId] = useState('');
  const [draftItems, setDraftItems] = useState<BundleItem[]>([]);

  const { data: tiers } = useQuery({
    queryKey: ['my-tiers', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: SubscriptionTier[] }>(`/creators/${user!.id}/tiers`);
      return data.data;
    },
  });

  const { data: bundles } = useQuery({
    queryKey: ['my-bundles', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: Bundle[] }>('/creators/me/bundles');
      return data.data;
    },
  });

  const { data: myCommunities } = useQuery({
    queryKey: ['my-communities-picker', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: string; name: string }> }>(
        `/creators/${user!.id}/communities`,
      );
      return data.data;
    },
  });

  const { data: myCourses } = useQuery({
    queryKey: ['my-courses-picker', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: string; title: string }> }>(
        '/creators/me/courses',
      );
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/creators/me/bundles', {
        name: name.trim(),
        tierId,
        description: description.trim() || undefined,
        items: draftItems,
      });
    },
    onSuccess: () => {
      setName('');
      setDescription('');
      setDraftItems([]);
      void qc.invalidateQueries({ queryKey: ['my-bundles', user?.id] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      await api.delete(`/creators/me/bundles/${bundleId}`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-bundles', user?.id] }),
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
      <Link href="/studio" className="mb-4 inline-block text-sm text-primary">
        ← Back to studio
      </Link>
      <PageHeader
        title="Product bundles"
        subtitle="Package community, courses, and more under one membership tier — checkout uses the linked tier price"
      />

      <section className="glass-panel mb-8 space-y-4 rounded-xl p-6">
        <h2 className="font-label-caps text-xs text-outline">Create bundle</h2>
        <Input placeholder="Bundle name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          placeholder="Short description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <label className="block text-xs text-on-surface-variant">
          Linked tier (billing)
          <select
            className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm"
            value={tierId}
            onChange={(e) => setTierId(e.target.value)}
          >
            <option value="">Select tier…</option>
            {(tiers ?? []).map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name} — {(tier.priceCents / 100).toFixed(0)} {tier.currency}
                {tier.billingInterval ? `/${tier.billingInterval}` : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2 rounded-lg border border-outline-variant/30 p-3">
          <p className="text-xs font-medium">Included resources</p>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-lg border border-outline-variant/40 bg-surface-container px-2 py-1 text-xs"
              value={resourceType}
              onChange={(e) => {
                setResourceType(e.target.value);
                setResourceId('');
              }}
            >
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {resourceType === 'community' ? (
              <select
                className="rounded-lg border border-outline-variant/40 bg-surface-container px-2 py-1 text-xs"
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
              >
                <option value="">Select community…</option>
                {(myCommunities ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : resourceType === 'course' ? (
              <select
                className="rounded-lg border border-outline-variant/40 bg-surface-container px-2 py-1 text-xs"
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
              >
                <option value="">Select course…</option>
                {(myCourses ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                className="max-w-xs text-xs"
                placeholder="Resource UUID (optional for creator-wide)"
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
              />
            )}
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => {
                if (!resourceType) return;
                setDraftItems((prev) => [
                  ...prev,
                  { resourceType, resourceId: resourceId.trim() || null },
                ]);
                setResourceId('');
              }}
            >
              Add item
            </Button>
          </div>
          {draftItems.length > 0 ? (
            <ul className="space-y-1 text-xs text-on-surface-variant">
              {draftItems.map((item, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span>
                    {item.resourceType}
                    {item.resourceId ? ` · ${item.resourceId.slice(0, 8)}…` : ''}
                  </span>
                  <button
                    type="button"
                    className="text-error"
                    onClick={() => setDraftItems((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-on-surface-variant">Add at least one resource.</p>
          )}
        </div>

        <Button
          disabled={
            createMutation.isPending ||
            !name.trim() ||
            !tierId ||
            draftItems.length === 0
          }
          onClick={() => createMutation.mutate()}
        >
          Create bundle
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-label-caps text-xs text-outline">Your bundles</h2>
        {(bundles ?? []).length === 0 ? (
          <p className="text-sm text-on-surface-variant">No bundles yet.</p>
        ) : (
          (bundles ?? []).map((bundle) => (
            <div
              key={bundle.id}
              className="rounded-xl border border-outline-variant/30 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{bundle.name}</p>
                  {bundle.description ? (
                    <p className="mt-1 text-xs text-on-surface-variant">{bundle.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-outline">
                    Tier: {bundle.tier?.name ?? bundle.tierId}
                    {bundle.tier
                      ? ` · ${(bundle.tier.priceCents / 100).toFixed(0)} ${bundle.tier.currency}/${bundle.tier.billingInterval}`
                      : ''}
                  </p>
                </div>
                <StatusPill tone={bundle.isActive ? 'primary' : 'neutral'} label={bundle.isActive ? 'Active' : 'Inactive'} />
              </div>
              <ul className="mt-3 space-y-1 text-xs text-on-surface-variant">
                {bundle.items.map((item) => (
                  <li key={item.id ?? `${item.resourceType}-${item.resourceId}`}>
                    {item.resourceType}
                    {item.resourceId ? ` · ${item.resourceId}` : ''}
                  </li>
                ))}
              </ul>
              {bundle.isActive ? (
                <Button
                  variant="secondary"
                  className="mt-3 text-xs"
                  disabled={deactivateMutation.isPending}
                  onClick={() => deactivateMutation.mutate(bundle.id)}
                >
                  Deactivate
                </Button>
              ) : null}
            </div>
          ))
        )}
      </section>
    </main>
  );
}
