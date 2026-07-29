'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button, Input } from '@forge/design-system';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-message';

type BadgeTier = {
  key: string;
  label: string;
  xpThreshold: number;
  icon?: string;
};

const EMPTY_TIER: BadgeTier = { key: '', label: '', xpThreshold: 0, icon: 'star' };

export function StudioBadgeConfigPanel({ communityId }: { communityId: string }) {
  const qc = useQueryClient();
  const [tiers, setTiers] = useState<BadgeTier[]>([{ ...EMPTY_TIER }]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['studio-badge-config', communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data } = await api.get<{
        data: BadgeTier[] | { data: BadgeTier[] };
      }>(`/creators/me/communities/${communityId}/badge-config`);
      const payload = data.data;
      return Array.isArray(payload) ? payload : payload?.data ?? [];
    },
  });

  useEffect(() => {
    if (!data) return;
    setTiers(data.length ? data.map((t) => ({ ...t, icon: t.icon || 'star' })) : [{ ...EMPTY_TIER }]);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleaned = tiers
        .map((t) => ({
          key: t.key.trim(),
          label: t.label.trim(),
          xpThreshold: Number(t.xpThreshold) || 0,
          icon: (t.icon || 'star').trim() || 'star',
        }))
        .filter((t) => t.key && t.label);
      const { data } = await api.put<{ data: BadgeTier[] | { data: BadgeTier[] } }>(
        `/creators/me/communities/${communityId}/badge-config`,
        { tiers: cleaned },
      );
      const payload = data.data;
      return Array.isArray(payload) ? payload : payload?.data ?? cleaned;
    },
    onSuccess: (saved) => {
      setError('');
      setMessage('Badge tiers saved.');
      setTiers(saved.length ? saved : [{ ...EMPTY_TIER }]);
      void qc.invalidateQueries({ queryKey: ['studio-badge-config', communityId] });
    },
    onError: (e) => {
      setMessage('');
      setError(getApiErrorMessage(e, 'Could not save badge config.'));
    },
  });

  return (
    <section className="space-y-3 rounded-xl border border-outline-variant/30 p-4">
      <div>
        <h3 className="font-semibold">Badge XP tiers</h3>
        <p className="mt-1 text-xs text-on-surface-variant">
          Configure up to 5 community badges unlocked by XP thresholds.
        </p>
      </div>

      {isLoading ? <p className="text-xs text-on-surface-variant">Loading badge config…</p> : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}
      {message ? <p className="text-sm text-secondary">{message}</p> : null}

      <div className="space-y-3">
        {tiers.map((tier, index) => (
          <div
            key={`badge-tier-${index}`}
            className="grid gap-2 rounded-lg bg-surface-container-low p-3 md:grid-cols-[1fr_1.2fr_110px_90px_auto]"
          >
            <Input
              value={tier.key}
              onChange={(e) => {
                const next = [...tiers];
                next[index] = { ...tier, key: e.target.value };
                setTiers(next);
              }}
              placeholder="key (e.g. bronze)"
            />
            <Input
              value={tier.label}
              onChange={(e) => {
                const next = [...tiers];
                next[index] = { ...tier, label: e.target.value };
                setTiers(next);
              }}
              placeholder="Label"
            />
            <Input
              type="number"
              min={0}
              value={String(tier.xpThreshold)}
              onChange={(e) => {
                const next = [...tiers];
                next[index] = { ...tier, xpThreshold: Number(e.target.value) || 0 };
                setTiers(next);
              }}
              placeholder="XP"
            />
            <Input
              value={tier.icon || ''}
              onChange={(e) => {
                const next = [...tiers];
                next[index] = { ...tier, icon: e.target.value };
                setTiers(next);
              }}
              placeholder="icon"
            />
            <button
              type="button"
              className="text-sm text-error hover:underline disabled:opacity-40"
              disabled={tiers.length <= 1}
              onClick={() => setTiers(tiers.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={tiers.length >= 5}
          onClick={() => setTiers([...tiers, { ...EMPTY_TIER }])}
          className="text-sm text-primary hover:underline disabled:opacity-40"
        >
          Add tier
        </button>
        <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? 'Saving…' : 'Save badge tiers'}
        </Button>
      </div>
    </section>
  );
}
