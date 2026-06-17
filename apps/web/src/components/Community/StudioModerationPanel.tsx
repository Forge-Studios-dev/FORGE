'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@forge/design-system';
import { api } from '@/lib/api';

type RoleRow = { id: string; userId: string; role: string; createdAt: string };
type BanRow = { id: string; userId: string; reason?: string | null; expiresAt?: string | null };
type ReportRow = {
  id: string;
  channelId?: string;
  messageId?: string;
  reason: string;
  status: string;
  createdAt: string;
};

const ROLES = ['moderator', 'admin', 'coach'] as const;

export function StudioModerationPanel({ communityId }: { communityId: string }) {
  const qc = useQueryClient();
  const [banUserId, setBanUserId] = useState('');
  const [banReason, setBanReason] = useState('');
  const [roleUserId, setRoleUserId] = useState('');
  const [roleType, setRoleType] = useState<string>('moderator');

  const { data: roles } = useQuery({
    queryKey: ['community-roles', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: RoleRow[] }>(
        `/creators/me/communities/${communityId}/roles`,
      );
      return data.data;
    },
  });

  const { data: bans } = useQuery({
    queryKey: ['community-bans', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: BanRow[] }>(
        `/creators/me/communities/${communityId}/bans`,
      );
      return data.data;
    },
  });

  const { data: reports } = useQuery({
    queryKey: ['community-reports', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: ReportRow[] }>(
        `/creators/me/communities/${communityId}/reports`,
      );
      return data.data;
    },
  });

  const banMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/creators/me/communities/${communityId}/bans`, {
        userId: banUserId.trim(),
        reason: banReason.trim() || undefined,
      });
    },
    onSuccess: () => {
      setBanUserId('');
      setBanReason('');
      void qc.invalidateQueries({ queryKey: ['community-bans', communityId] });
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/creators/me/communities/${communityId}/bans/${userId}/remove`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['community-bans', communityId] }),
  });

  const roleMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/creators/me/communities/${communityId}/roles`, {
        userId: roleUserId.trim(),
        role: roleType,
      });
    },
    onSuccess: () => {
      setRoleUserId('');
      void qc.invalidateQueries({ queryKey: ['community-roles', communityId] });
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/creators/me/communities/${communityId}/roles/${userId}`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['community-roles', communityId] }),
  });

  return (
    <div className="space-y-8">
      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h3 className="font-label-caps text-outline">Ban member</h3>
        <Input
          value={banUserId}
          onChange={(e) => setBanUserId(e.target.value)}
          placeholder="User ID"
        />
        <Input
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
          placeholder="Reason (optional)"
        />
        <Button
          disabled={!banUserId.trim() || banMutation.isPending}
          onClick={() => banMutation.mutate()}
        >
          Ban
        </Button>
        <ul className="space-y-2 pt-2">
          {(bans ?? []).map((b) => (
            <li key={b.id} className="flex items-center justify-between text-sm">
              <span className="truncate text-on-surface-variant">
                {b.userId}
                {b.reason ? ` — ${b.reason}` : ''}
              </span>
              <Button
                variant="ghost"
                className="text-xs"
                onClick={() => unbanMutation.mutate(b.userId)}
              >
                Unban
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h3 className="font-label-caps text-outline">Assign role</h3>
        <Input
          value={roleUserId}
          onChange={(e) => setRoleUserId(e.target.value)}
          placeholder="User ID"
        />
        <select
          value={roleType}
          onChange={(e) => setRoleType(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Button
          disabled={!roleUserId.trim() || roleMutation.isPending}
          onClick={() => roleMutation.mutate()}
        >
          Assign
        </Button>
        <ul className="space-y-2 pt-2">
          {(roles ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm">
              <span>
                {r.userId} · <span className="capitalize">{r.role}</span>
              </span>
              <Button
                variant="ghost"
                className="text-xs"
                onClick={() => removeRoleMutation.mutate(r.userId)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h3 className="font-label-caps text-outline">Open reports</h3>
        {(reports ?? []).length === 0 ? (
          <p className="text-sm text-on-surface-variant">No open reports.</p>
        ) : (
          <ul className="space-y-2">
            {(reports ?? []).map((r) => (
              <li key={r.id} className="rounded-lg border border-outline-variant/40 p-3 text-sm">
                <p className="font-medium">{r.reason}</p>
                <p className="text-xs text-on-surface-variant">
                  Message {r.messageId ?? '—'} · {new Date(r.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
