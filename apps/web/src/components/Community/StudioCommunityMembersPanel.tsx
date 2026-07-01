'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@forge/design-system';
import { api } from '@/lib/api';

type CommunityMemberRow = {
  id: string;
  userId: string;
  status: string;
  source: string;
  user?: { username?: string; displayName?: string };
};

export function StudioCommunityMembersPanel({ communityId }: { communityId: string }) {
  const qc = useQueryClient();

  const { data: pending, isLoading: pendingLoading } = useQuery({
    queryKey: ['community-members-pending', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: CommunityMemberRow[] }>(
        `/creators/me/communities/${communityId}/members?status=pending`,
      );
      return data.data;
    },
  });

  const { data: active, isLoading: activeLoading } = useQuery({
    queryKey: ['community-members-active', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: CommunityMemberRow[] }>(
        `/creators/me/communities/${communityId}/members?status=active`,
      );
      return data.data;
    },
  });

  const { data: suspended, isLoading: suspendedLoading } = useQuery({
    queryKey: ['community-members-suspended', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: CommunityMemberRow[] }>(
        `/creators/me/communities/${communityId}/members?status=suspended`,
      );
      return data.data;
    },
  });

  const invalidateMembers = () => {
    void qc.invalidateQueries({ queryKey: ['community-members-active', communityId] });
    void qc.invalidateQueries({ queryKey: ['community-members-suspended', communityId] });
  };

  const suspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/creators/me/communities/${communityId}/members/${userId}/suspend`);
    },
    onSuccess: invalidateMembers,
  });

  const unsuspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/creators/me/communities/${communityId}/members/${userId}/unsuspend`);
    },
    onSuccess: invalidateMembers,
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/creators/me/communities/${communityId}/members/${userId}/approve`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community-members-pending', communityId] });
      void qc.invalidateQueries({ queryKey: ['community-members-active', communityId] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/creators/me/communities/${communityId}/members/${userId}/reject`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community-members-pending', communityId] });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get<Blob>(
        `/creators/me/communities/${communityId}/members/export`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `community-${communityId}-members.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });

  const memberLabel = (row: CommunityMemberRow) =>
    row.user?.displayName ?? row.user?.username ?? row.userId.slice(0, 8);

  return (
    <div className="space-y-6">
      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">Join requests</h2>
        {pendingLoading ? (
          <p className="text-sm text-on-surface-variant">Loading…</p>
        ) : (pending ?? []).length === 0 ? (
          <p className="text-sm text-on-surface-variant">No pending join requests.</p>
        ) : (
          <ul className="space-y-2">
            {(pending ?? []).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/30 p-3">
                <div>
                  <p className="font-medium">{memberLabel(row)}</p>
                  <p className="text-xs text-on-surface-variant">{row.source}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="text-xs"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(row.userId)}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs text-error"
                    disabled={rejectMutation.isPending}
                    onClick={() => {
                      if (window.confirm('Reject this join request?')) {
                        rejectMutation.mutate(row.userId);
                      }
                    }}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-panel space-y-3 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-label-caps text-outline">Active members</h2>
          <Button
            variant="secondary"
            className="text-xs"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            {exportMutation.isPending ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
        {activeLoading ? (
          <p className="text-sm text-on-surface-variant">Loading…</p>
        ) : (active ?? []).length === 0 ? (
          <p className="text-sm text-on-surface-variant">No active community members yet.</p>
        ) : (
          <ul className="space-y-2">
            {(active ?? []).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/30 p-3">
                <div>
                  <p className="font-medium">{memberLabel(row)}</p>
                  <p className="text-xs capitalize text-on-surface-variant">{row.source}</p>
                </div>
                <Button
                  variant="ghost"
                  className="text-xs text-error"
                  disabled={suspendMutation.isPending}
                  onClick={() => {
                    if (window.confirm('Suspend this member? They will lose community access.')) {
                      suspendMutation.mutate(row.userId);
                    }
                  }}
                >
                  Suspend
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">Suspended members</h2>
        {suspendedLoading ? (
          <p className="text-sm text-on-surface-variant">Loading…</p>
        ) : (suspended ?? []).length === 0 ? (
          <p className="text-sm text-on-surface-variant">No suspended members.</p>
        ) : (
          <ul className="space-y-2">
            {(suspended ?? []).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/30 p-3">
                <div>
                  <p className="font-medium">{memberLabel(row)}</p>
                  <p className="text-xs capitalize text-on-surface-variant">{row.source}</p>
                </div>
                <Button
                  variant="secondary"
                  className="text-xs"
                  disabled={unsuspendMutation.isPending}
                  onClick={() => unsuspendMutation.mutate(row.userId)}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
