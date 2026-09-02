'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { EmptyState, Icon, ListSkeleton, PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';
import { SkillFeatureGate } from '@/components/SkillFeatureGate';

type Community = { id: string; name: string; slug: string };
type Reward = {
  id: string;
  title: string;
  description?: string | null;
  costPoints: number;
  requiresApproval?: boolean;
  status?: string;
};
type Redemption = {
  id: string;
  status: string;
  rewardId?: string;
  userId?: string;
  message?: string | null;
  createdAt: string;
  reward?: { title?: string } | null;
  user?: { username?: string; displayName?: string } | null;
};

export default function StudioChannelPointsPage() {
  return (
    <SkillFeatureGate feature="channelPoints">
      <StudioChannelPointsPageInner />
    </SkillFeatureGate>
  );
}

function StudioChannelPointsPageInner() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [communityId, setCommunityId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [costPoints, setCostPoints] = useState('100');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCost, setEditCost] = useState('100');
  const [editRequiresApproval, setEditRequiresApproval] = useState(true);

  const { data: communities } = useQuery({
    queryKey: ['studio-communities', user?.id],
    enabled: isCreator && !!user?.id,
    queryFn: async () => {
      const { data } = await api.get<{ data: Community[] }>(`/creators/${user!.id}/communities`);
      return data.data;
    },
  });

  useEffect(() => {
    if (!communityId && communities?.length) setCommunityId(communities[0].id);
  }, [communities, communityId]);

  const { data: rewards, isLoading: rewardsLoading } = useQuery({
    queryKey: ['studio-channel-rewards', communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: Reward[] } }>(
        `/creators/me/communities/${communityId}/channel-points/rewards`,
      );
      return data.data?.data ?? [];
    },
  });

  const { data: redemptions, isLoading: redemptionsLoading } = useQuery({
    queryKey: ['studio-channel-redemptions', communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: Redemption[] } }>(
        `/creators/me/communities/${communityId}/channel-points/redemptions?status=pending`,
      );
      return data.data?.data ?? [];
    },
  });

  const invalidateRewards = () =>
    void qc.invalidateQueries({ queryKey: ['studio-channel-rewards', communityId] });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/creators/me/communities/${communityId}/channel-points/rewards`, {
        title: title.trim(),
        description: description.trim() || undefined,
        costPoints: Number(costPoints) || 1,
        requiresApproval,
      });
    },
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setError('');
      invalidateRewards();
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not create reward.')),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      await api.patch(`/creators/me/communities/${communityId}/channel-points/rewards/${editingId}`, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        costPoints: Number(editCost) || 1,
        requiresApproval: editRequiresApproval,
      });
    },
    onSuccess: () => {
      setEditingId(null);
      setError('');
      invalidateRewards();
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not update reward.')),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ rewardId, status }: { rewardId: string; status: 'active' | 'paused' }) => {
      await api.patch(`/creators/me/communities/${communityId}/channel-points/rewards/${rewardId}`, {
        status,
      });
    },
    onSuccess: () => invalidateRewards(),
    onError: (e) => setError(getApiErrorMessage(e, 'Could not update reward status.')),
  });

  const archiveMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      await api.delete(`/creators/me/communities/${communityId}/channel-points/rewards/${rewardId}`);
    },
    onSuccess: () => invalidateRewards(),
    onError: (e) => setError(getApiErrorMessage(e, 'Could not archive reward.')),
  });

  const approveMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      await api.post(
        `/creators/me/communities/${communityId}/channel-points/redemptions/${redemptionId}/approve`,
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['studio-channel-redemptions', communityId] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      await api.post(
        `/creators/me/communities/${communityId}/channel-points/redemptions/${redemptionId}/reject`,
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['studio-channel-redemptions', communityId] }),
  });

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <PageHeader title="Channel points" subtitle="Creator access required." />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Channel points"
        subtitle="Create rewards and approve redemptions to keep community engagement healthy."
      />

      <label className="block max-w-md text-sm">
        <span className="text-on-surface-variant">Community</span>
        <select
          value={communityId}
          onChange={(e) => setCommunityId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5"
        >
          {(communities ?? []).length === 0 ? <option value="">No communities yet</option> : null}
          {(communities ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {!communityId ? (
        <EmptyState
          icon="hub"
          title="Create a community first"
          description="Channel points are scoped to a community. Set one up, then return here to invent rewards."
          action={{ label: 'Open communities', href: '/studio/communities' }}
        />
      ) : (
        <>
          <section className="glass-panel space-y-4 rounded-2xl p-6">
            <div>
              <p className="font-label-caps text-xs text-outline">Rewards</p>
              <h2 className="mt-1 text-lg font-semibold">Create a reward</h2>
            </div>
            {error ? <p className="text-sm text-error">{error}</p> : null}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reward title"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What members get"
              rows={2}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sm">
                Cost
                <input
                  type="number"
                  min={1}
                  value={costPoints}
                  onChange={(e) => setCostPoints(e.target.value)}
                  className="ml-2 w-28 rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                />
                Requires approval
              </label>
            </div>
            <button
              type="button"
              disabled={!title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="primary-button inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              <Icon name="add" />
              {createMutation.isPending ? 'Saving…' : 'Create reward'}
            </button>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Manage rewards</h2>
              {rewardsLoading ? <ListSkeleton rows={3} /> : null}
              {!rewardsLoading && !(rewards?.length ?? 0) ? (
                <p className="text-sm text-on-surface-variant">No rewards yet.</p>
              ) : null}
              <ul className="space-y-3">
                {(rewards ?? []).map((reward) => (
                  <li key={reward.id} className="glass-panel space-y-3 rounded-2xl p-4">
                    {editingId === reward.id ? (
                      <>
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm"
                        />
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={2}
                          className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="text-sm">
                            Cost
                            <input
                              type="number"
                              min={1}
                              value={editCost}
                              onChange={(e) => setEditCost(e.target.value)}
                              className="ml-2 w-24 rounded-xl border border-outline-variant/40 bg-surface-container-low px-2 py-1"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editRequiresApproval}
                              onChange={(e) => setEditRequiresApproval(e.target.checked)}
                            />
                            Requires approval
                          </label>
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            className="text-sm text-primary hover:underline"
                            disabled={!editTitle.trim() || updateMutation.isPending}
                            onClick={() => updateMutation.mutate()}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="text-sm text-on-surface-variant hover:underline"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{reward.title}</p>
                            {reward.description ? (
                              <p className="mt-1 text-sm text-on-surface-variant">{reward.description}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <StatusPill tone="reward" label={`${reward.costPoints} pts`} />
                            <StatusPill
                              tone={reward.status === 'paused' ? 'warning' : 'success'}
                              label={reward.status ?? 'active'}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            className="text-sm text-primary hover:underline"
                            onClick={() => {
                              setEditingId(reward.id);
                              setEditTitle(reward.title);
                              setEditDescription(reward.description ?? '');
                              setEditCost(String(reward.costPoints));
                              setEditRequiresApproval(!!reward.requiresApproval);
                            }}
                          >
                            Edit
                          </button>
                          {reward.status === 'paused' ? (
                            <button
                              type="button"
                              className="text-sm text-primary hover:underline"
                              onClick={() =>
                                statusMutation.mutate({ rewardId: reward.id, status: 'active' })
                              }
                            >
                              Resume
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-sm text-on-surface-variant hover:underline"
                              onClick={() =>
                                statusMutation.mutate({ rewardId: reward.id, status: 'paused' })
                              }
                            >
                              Pause
                            </button>
                          )}
                          <button
                            type="button"
                            className="text-sm text-error hover:underline"
                            onClick={() => {
                              if (window.confirm(`Archive “${reward.title}”?`)) {
                                archiveMutation.mutate(reward.id);
                              }
                            }}
                          >
                            Archive
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Pending redemptions</h2>
              {redemptionsLoading ? <ListSkeleton rows={3} /> : null}
              {!redemptionsLoading && !(redemptions?.length ?? 0) ? (
                <p className="text-sm text-on-surface-variant">No pending redemptions.</p>
              ) : null}
              <ul className="space-y-3">
                {(redemptions ?? []).map((item) => (
                  <li key={item.id} className="glass-panel rounded-2xl p-4">
                    <p className="font-medium">
                      {item.reward?.title ??
                        (rewards ?? []).find((r) => r.id === item.rewardId)?.title ??
                        `Reward ${item.rewardId?.slice(0, 8) ?? item.id.slice(0, 8)}`}
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {item.user?.displayName ||
                        item.user?.username ||
                        (item.userId ? `Member ${item.userId.slice(0, 8)}` : 'Member')}
                      {item.message ? ` · ${item.message}` : ''}
                    </p>
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        className="text-sm text-primary hover:underline"
                        onClick={() => approveMutation.mutate(item.id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="text-sm text-error hover:underline"
                        onClick={() => rejectMutation.mutate(item.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
