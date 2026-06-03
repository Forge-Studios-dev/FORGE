'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SubscriptionTier } from '@/types';

export default function StudioTiersPage() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [priceCents, setPriceCents] = useState('9900');
  const [benefits, setBenefits] = useState('');

  const { data: tiers } = useQuery({
    queryKey: ['my-tiers', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: SubscriptionTier[] }>(`/creators/${user!.id}/tiers`);
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/creators/me/tiers', {
        name: name.trim(),
        priceCents: Number(priceCents) || 0,
        benefits: benefits
          .split('\n')
          .map((b) => b.trim())
          .filter(Boolean),
      });
    },
    onSuccess: () => {
      setName('');
      setBenefits('');
      void qc.invalidateQueries({ queryKey: ['my-tiers', user?.id] });
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
      <PageHeader
        title="Membership tiers"
        subtitle="Configure member levels (mock billing until payments launch)"
      />

      <section className="glass-panel mb-8 space-y-4 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">New tier</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tier name, e.g. Gold"
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2.5"
        />
        <input
          value={priceCents}
          onChange={(e) => setPriceCents(e.target.value)}
          placeholder="Price in cents (e.g. 99900 = ₹999)"
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2.5"
        />
        <textarea
          value={benefits}
          onChange={(e) => setBenefits(e.target.value)}
          placeholder="Benefits (one per line)"
          rows={3}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2.5"
        />
        <button
          type="button"
          disabled={!name.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="primary-button rounded-full px-6 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-40"
        >
          {createMutation.isPending ? 'Creating…' : 'Create tier'}
        </button>
      </section>

      <h2 className="mb-4 font-semibold">Your tiers</h2>
      <ul className="space-y-3">
        {(tiers ?? []).map((t) => (
          <li key={t.id} className="glass-panel rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t.name}</span>
              <span className="text-sm text-on-surface-variant">
                {t.currency} {(t.priceCents / 100).toFixed(0)}/mo
              </span>
            </div>
            {t.benefits?.length ? (
              <ul className="mt-2 list-inside list-disc text-sm text-on-surface-variant">
                {t.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
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
