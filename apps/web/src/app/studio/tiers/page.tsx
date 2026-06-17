'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { PageHeader, Button } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SubscriptionTier } from '@/types';

const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true';

type TierEntitlement = {
  id: string;
  resourceType: string;
  resourceId?: string | null;
  accessLevel: string;
};

export default function StudioTiersPage() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [priceCents, setPriceCents] = useState('9900');
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [trialDays, setTrialDays] = useState('0');
  const [benefits, setBenefits] = useState('');
  const [expandedTierId, setExpandedTierId] = useState<string | null>(null);
  const [entResourceType, setEntResourceType] = useState('community');
  const [entResourceId, setEntResourceId] = useState('');

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
        billingInterval,
        trialDays: Number(trialDays) || 0,
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

  const addEntitlementMutation = useMutation({
    mutationFn: async ({ tierId }: { tierId: string }) => {
      await api.post(`/creators/me/tiers/${tierId}/entitlements`, {
        resourceType: entResourceType,
        resourceId: entResourceId.trim() || undefined,
        accessLevel: 'full',
      });
    },
    onSuccess: (_d, vars) => {
      setEntResourceId('');
      void qc.invalidateQueries({ queryKey: ['tier-entitlements', vars.tierId] });
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
        subtitle={
          BILLING_ENABLED
            ? 'Stripe checkout enabled for recurring memberships'
            : 'Mock billing — enable Stripe for production checkout'
        }
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
        <select
          value={billingInterval}
          onChange={(e) => setBillingInterval(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm"
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
          <option value="lifetime">Lifetime</option>
        </select>
        <input
          value={trialDays}
          onChange={(e) => setTrialDays(e.target.value)}
          placeholder="Trial days (0 = none)"
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
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{t.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-on-surface-variant">
                  {t.currency} {(t.priceCents / 100).toFixed(0)}
                </span>
                <Button
                  variant="ghost"
                  className="text-xs"
                  onClick={() => setExpandedTierId(expandedTierId === t.id ? null : t.id)}
                >
                  Entitlements
                </Button>
              </div>
            </div>
            {t.benefits?.length ? (
              <ul className="mt-2 list-inside list-disc text-sm text-on-surface-variant">
                {t.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
            {expandedTierId === t.id ? (
              <TierEntitlementsEditor
                tierId={t.id}
                entResourceType={entResourceType}
                entResourceId={entResourceId}
                onResourceTypeChange={setEntResourceType}
                onResourceIdChange={setEntResourceId}
                onAdd={() => addEntitlementMutation.mutate({ tierId: t.id })}
                adding={addEntitlementMutation.isPending}
              />
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

function TierEntitlementsEditor({
  tierId,
  entResourceType,
  entResourceId,
  onResourceTypeChange,
  onResourceIdChange,
  onAdd,
  adding,
}: {
  tierId: string;
  entResourceType: string;
  entResourceId: string;
  onResourceTypeChange: (v: string) => void;
  onResourceIdChange: (v: string) => void;
  onAdd: () => void;
  adding: boolean;
}) {
  const qc = useQueryClient();
  const { data: entitlements } = useQuery({
    queryKey: ['tier-entitlements', tierId],
    queryFn: async () => {
      const { data } = await api.get<{ data: TierEntitlement[] }>(
        `/creators/me/tiers/${tierId}/entitlements`,
      );
      return data.data;
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (entitlementId: string) => {
      await api.delete(`/creators/me/tiers/${tierId}/entitlements/${entitlementId}`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tier-entitlements', tierId] }),
  });

  return (
    <div className="mt-4 space-y-2 border-t border-outline-variant/40 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-outline">Resource entitlements</p>
      <ul className="space-y-1 text-sm text-on-surface-variant">
        {(entitlements ?? []).map((e) => (
          <li key={e.id} className="flex items-center justify-between">
            <span>
              {e.resourceType}
              {e.resourceId ? ` · ${e.resourceId}` : ' (all)'}
            </span>
            <Button
              variant="ghost"
              className="text-xs"
              onClick={() => removeMutation.mutate(e.id)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <select
        value={entResourceType}
        onChange={(e) => onResourceTypeChange(e.target.value)}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
      >
        <option value="community">Community</option>
        <option value="channel">Channel</option>
        <option value="course">Course</option>
        <option value="video">Video</option>
        <option value="stream">Stream</option>
        <option value="event">Event</option>
        <option value="creator">Creator-wide</option>
      </select>
      <input
        value={entResourceId}
        onChange={(e) => onResourceIdChange(e.target.value)}
        placeholder="Resource ID (optional for creator-wide)"
        className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
      />
      <Button disabled={adding} onClick={onAdd} className="text-xs">
        Add entitlement
      </Button>
    </div>
  );
}
