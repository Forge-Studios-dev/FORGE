'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SubscriberPicker } from '@/components/Community/SubscriberPicker';
import { SubscriptionTier } from '@/types';

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
  const [grantUserId, setGrantUserId] = useState('');
  const [grantTierId, setGrantTierId] = useState('');
  const [grantCommunityId, setGrantCommunityId] = useState('');
  const [grantDays, setGrantDays] = useState('30');

  const { data: tiers } = useQuery({
    queryKey: ['studio-tiers-grant', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: SubscriptionTier[] }>(
        `/creators/${user!.id}/tiers`,
      );
      return data.data;
    },
  });

  const { data: communities } = useQuery({
    queryKey: ['studio-communities-grant', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: string; name: string }> }>(
        `/creators/${user!.id}/communities`,
      );
      return data.data;
    },
  });

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

  const grantMutation = useMutation({
    mutationFn: async () => {
      await api.post('/creators/me/subscribers/grant', {
        userId: grantUserId,
        tierId: grantTierId,
        ...(grantCommunityId ? { communityId: grantCommunityId } : {}),
        expiresInDays: Number(grantDays) || 30,
      });
    },
    onSuccess: () => {
      setGrantUserId('');
      void qc.invalidateQueries({ queryKey: ['studio-subscribers', user?.id] });
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
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader title="Subscribers" subtitle="Manage your active members and export data" />

      <div className="mb-6 flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => {
            window.open(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/creators/me/subscribers/export`, '_blank');
          }}
        >
          Export CSV
        </Button>
      </div>

      <section className="glass-panel mb-6 space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">Grant complimentary access</h2>
        <SubscriberPicker
          value={grantUserId}
          onChange={setGrantUserId}
          placeholder="Search subscribers or paste user id"
        />
        <Input
          value={grantUserId}
          onChange={(e) => setGrantUserId(e.target.value.trim())}
          placeholder="Or enter user UUID directly"
        />
        <label className="block text-xs text-on-surface-variant">
          Tier
          <select
            className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface-container-high px-2 py-1.5 text-sm"
            value={grantTierId}
            onChange={(e) => setGrantTierId(e.target.value)}
          >
            <option value="">Select tier…</option>
            {(tiers ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-on-surface-variant">
          Community scope (optional)
          <select
            className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface-container-high px-2 py-1.5 text-sm"
            value={grantCommunityId}
            onChange={(e) => setGrantCommunityId(e.target.value)}
          >
            <option value="">Creator-wide</option>
            {(communities ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Input
          type="number"
          min={1}
          value={grantDays}
          onChange={(e) => setGrantDays(e.target.value)}
          placeholder="Expires in days"
        />
        <Button
          disabled={!grantUserId || !grantTierId || grantMutation.isPending}
          onClick={() => grantMutation.mutate()}
        >
          Grant membership
        </Button>
      </section>

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
