'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SubscriptionTier } from '@/types';
import { StudioModerationPanel } from '@/components/Community/StudioModerationPanel';

type Community = {
  id: string;
  name: string;
  slug: string;
  visibility: string;
};

type Category = { id: string; name: string; slug: string; sortOrder: number };
type Channel = {
  id: string;
  name: string;
  slug: string;
  type: string;
  categoryId?: string | null;
  requiredTierId?: string | null;
};

type Tab = 'channels' | 'categories' | 'moderation' | 'settings';

export default function StudioCommunityDetailPage() {
  const params = useParams();
  const communityId = typeof params.id === 'string' ? params.id : '';
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('channels');
  const [categoryName, setCategoryName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState('public');
  const [channelTierId, setChannelTierId] = useState('');
  const [visibility, setVisibility] = useState('public');

  const { data: payload } = useQuery({
    queryKey: ['studio-community-detail', communityId, user?.id],
    enabled: !!communityId && !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { community: Community; categories: Category[]; channels: Channel[] };
      }>(`/communities/id/${communityId}`);
      return data.data;
    },
  });

  const { data: tiers } = useQuery({
    queryKey: ['my-tiers', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: SubscriptionTier[] }>(`/creators/${user!.id}/tiers`);
      return data.data;
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/creators/me/communities/${communityId}/categories`, {
        name: categoryName.trim(),
      });
    },
    onSuccess: () => {
      setCategoryName('');
      void qc.invalidateQueries({ queryKey: ['studio-community-detail', communityId] });
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/creators/me/communities/${communityId}/channels`, {
        name: channelName.trim(),
        type: channelType,
        requiredTierId: channelTierId || undefined,
      });
    },
    onSuccess: () => {
      setChannelName('');
      void qc.invalidateQueries({ queryKey: ['studio-community-detail', communityId] });
    },
  });

  const updateCommunityMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/creators/me/communities/${communityId}`, { visibility });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['studio-community-detail', communityId] });
    },
  });

  if (!isCreator) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-8">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  const community = payload?.community;

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader
        title={community?.name ?? 'Community'}
        subtitle={community ? `/${community.slug}` : 'Manage community'}
      />

      <nav className="mb-6 flex flex-wrap gap-2">
        {(['channels', 'categories', 'moderation', 'settings'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm capitalize ${
              tab === t
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 'channels' ? (
        <div className="space-y-6">
          <section className="glass-panel space-y-3 rounded-xl p-6">
            <h2 className="font-label-caps text-outline">New channel</h2>
            <Input
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Channel name"
            />
            <select
              value={channelType}
              onChange={(e) => setChannelType(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            >
              <option value="public">Public</option>
              <option value="subscribers">Members only</option>
              <option value="tier">Tier gated</option>
              <option value="invite">Invite only</option>
            </select>
            <select
              value={channelTierId}
              onChange={(e) => setChannelTierId(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            >
              <option value="">Tier (optional)</option>
              {(tiers ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Button
              disabled={!channelName.trim() || createChannelMutation.isPending}
              onClick={() => createChannelMutation.mutate()}
            >
              Create channel
            </Button>
          </section>
          <ul className="space-y-2">
            {(payload?.channels ?? []).map((ch) => (
              <li key={ch.id} className="glass-panel rounded-xl p-4">
                <p className="font-medium">{ch.name}</p>
                <p className="text-xs capitalize text-on-surface-variant">
                  {ch.type} · #{ch.slug}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === 'categories' ? (
        <div className="space-y-6">
          <section className="glass-panel space-y-3 rounded-xl p-6">
            <h2 className="font-label-caps text-outline">New category</h2>
            <Input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Category name"
            />
            <Button
              disabled={!categoryName.trim() || createCategoryMutation.isPending}
              onClick={() => createCategoryMutation.mutate()}
            >
              Create category
            </Button>
          </section>
          <ul className="space-y-2">
            {(payload?.categories ?? []).map((cat) => (
              <li key={cat.id} className="glass-panel rounded-xl p-4">
                <p className="font-medium">{cat.name}</p>
                <p className="text-xs text-on-surface-variant">#{cat.slug}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === 'moderation' ? <StudioModerationPanel communityId={communityId} /> : null}

      {tab === 'settings' ? (
        <section className="glass-panel space-y-3 rounded-xl p-6">
          <h2 className="font-label-caps text-outline">Visibility</h2>
          <select
            value={visibility || community?.visibility || 'public'}
            onChange={(e) => setVisibility(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="paid">Paid members only</option>
            <option value="invite">Invite only</option>
          </select>
          <Button
            disabled={updateCommunityMutation.isPending}
            onClick={() => updateCommunityMutation.mutate()}
          >
            Save settings
          </Button>
        </section>
      ) : null}

      <div className="mt-8 flex gap-4 text-sm">
        <Link href="/studio/communities" className="text-primary hover:underline">
          ← All communities
        </Link>
        {user?.username && community ? (
          <Link
            href={`/${user.username}/c/${community.slug}`}
            className="text-primary hover:underline"
          >
            View public page
          </Link>
        ) : null}
      </div>
    </main>
  );
}
