'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, PageHeader } from '@forge/design-system';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SubscriptionTier } from '@/types';

type Channel = {
  id: string;
  name: string;
  slug: string;
  type: string;
  requiredTierId?: string | null;
};

export default function StudioCommunityPage() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('public');
  const [editTierId, setEditTierId] = useState('');
  const [inviteUserId, setInviteUserId] = useState('');
  const [invitingChannelId, setInvitingChannelId] = useState<string | null>(null);

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

  const { data: tiers } = useQuery({
    queryKey: ['my-tiers', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data: res } = await api.get<{ data: SubscriptionTier[] }>(
        `/creators/${user!.id}/tiers`,
      );
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; type: string; requiredTierId?: string }) => {
      await api.post('/creators/me/channels', payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studio-community', user?.id] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      channelId,
      payload,
    }: {
      channelId: string;
      payload: { name?: string; type?: string; requiredTierId?: string | null };
    }) => {
      await api.patch(`/creators/me/channels/${channelId}`, payload);
    },
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ['studio-community', user?.id] });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ channelId, userId }: { channelId: string; userId: string }) => {
      await api.post(`/creators/me/channels/${channelId}/invite`, { userId });
    },
    onSuccess: () => {
      setInviteUserId('');
      setInvitingChannelId(null);
    },
  });

  if (!isCreator) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  const moderateHref = user?.username ? `/${user.username}/community` : '/studio';

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
            const requiredTierId = String(fd.get('requiredTierId') ?? '').trim() || undefined;
            if (!name) return;
            createMutation.mutate({ name, type, requiredTierId });
            e.currentTarget.reset();
          }}
        >
          <Input name="name" placeholder="Channel name" className="min-w-[160px] flex-1" />
          <select
            name="type"
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          >
            <option value="public">Public</option>
            <option value="subscribers">Members only</option>
            <option value="tier">Tier gated</option>
            <option value="invite">Invite only</option>
          </select>
          <select
            name="requiredTierId"
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            defaultValue=""
          >
            <option value="">Tier (optional)</option>
            {(tiers ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={createMutation.isPending}>
            Create
          </Button>
        </form>
      </section>

      <ul className="space-y-2">
        {(data?.channels ?? []).map((ch) => (
          <li key={ch.id} className="glass-panel rounded-xl p-4">
            {editingId === ch.id ? (
              <div className="space-y-2">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
                >
                  <option value="public">Public</option>
                  <option value="subscribers">Members only</option>
                  <option value="tier">Tier gated</option>
                  <option value="invite">Invite only</option>
                </select>
                <select
                  value={editTierId}
                  onChange={(e) => setEditTierId(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
                >
                  <option value="">No tier requirement</option>
                  {(tiers ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      updateMutation.mutate({
                        channelId: ch.id,
                        payload: {
                          name: editName,
                          type: editType,
                          requiredTierId: editTierId || null,
                        },
                      })
                    }
                    disabled={updateMutation.isPending}
                  >
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{ch.name}</p>
                  <p className="text-xs capitalize text-on-surface-variant">{ch.type}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-on-surface-variant">#{ch.slug}</span>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => {
                      setEditingId(ch.id);
                      setEditName(ch.name);
                      setEditType(ch.type);
                      setEditTierId(ch.requiredTierId ?? '');
                    }}
                  >
                    Edit
                  </Button>
                  {ch.type === 'invite' ? (
                    <Button
                      variant="outline"
                      className="px-2 py-1 text-xs"
                      onClick={() =>
                        setInvitingChannelId(invitingChannelId === ch.id ? null : ch.id)
                      }
                    >
                      Invite
                    </Button>
                  ) : null}
                  <Link
                    href={moderateHref}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Moderate
                  </Link>
                </div>
              </div>
            )}
            {invitingChannelId === ch.id ? (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!inviteUserId.trim()) return;
                  inviteMutation.mutate({ channelId: ch.id, userId: inviteUserId.trim() });
                }}
              >
                <Input
                  value={inviteUserId}
                  onChange={(e) => setInviteUserId(e.target.value)}
                  placeholder="User ID to invite"
                  className="flex-1 text-sm"
                />
                <Button type="submit" disabled={inviteMutation.isPending} className="text-xs">
                  Send invite
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      <Link href="/studio" className="mt-8 inline-block text-sm text-primary hover:underline">
        ← Back to Studio
      </Link>
    </main>
  );
}
