'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@forge/design-system';
import { api } from '@/lib/api';
import { SubscriberPicker } from './SubscriberPicker';

type RoleRow = { id: string; userId: string; role: string; createdAt: string };
type BanRow = { id: string; userId: string; reason?: string | null; expiresAt?: string | null };
type ReportRow = {
  id: string;
  targetType?: string;
  channelId?: string;
  messageId?: string;
  postId?: string;
  pollId?: string;
  reportedUserId?: string;
  reason: string;
  status: string;
  createdAt: string;
};

const ROLES = ['moderator', 'admin', 'coach'] as const;

function ReportPreview({
  communityId,
  report,
}: {
  communityId: string;
  report: ReportRow;
}) {
  const type = report.targetType ?? 'message';

  const { data: messagePreview } = useQuery({
    queryKey: ['report-message-preview', report.channelId, report.messageId],
    enabled: type === 'message' && !!report.channelId && !!report.messageId,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { data: Array<{ id: string; body: string; user?: { displayName?: string } }> };
      }>(`/channels/${report.channelId}/messages?limit=100`);
      return data.data.data.find((m) => m.id === report.messageId) ?? null;
    },
  });

  const { data: postPreview } = useQuery({
    queryKey: ['report-post-preview', communityId, report.postId],
    enabled: type === 'post' && !!report.postId,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { data: Array<{ id: string; title?: string; body: string }> };
      }>(`/communities/${communityId}/posts`);
      return data.data.data.find((p) => p.id === report.postId) ?? null;
    },
  });

  if (type === 'message' && messagePreview) {
    return (
      <p className="mt-1 text-xs text-on-surface-variant">
        Message — {messagePreview.user?.displayName ?? 'Member'}: &ldquo;{messagePreview.body}&rdquo;
      </p>
    );
  }
  if (type === 'post' && postPreview) {
    return (
      <p className="mt-1 text-xs text-on-surface-variant">
        Post — {postPreview.title ?? 'Untitled'}: {postPreview.body.slice(0, 120)}
      </p>
    );
  }
  if (type === 'poll' && report.pollId) {
    return <p className="mt-1 text-xs text-on-surface-variant">Poll report · {report.pollId}</p>;
  }
  if (type === 'user' && report.reportedUserId) {
    return (
      <p className="mt-1 text-xs text-on-surface-variant">User report · {report.reportedUserId}</p>
    );
  }
  return <p className="mt-1 text-xs italic text-outline">Content not found or removed</p>;
}

export function StudioModerationPanel({ communityId }: { communityId: string }) {
  const qc = useQueryClient();
  const [banUserId, setBanUserId] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banExpiresAt, setBanExpiresAt] = useState('');
  const [roleUserId, setRoleUserId] = useState('');
  const [roleType, setRoleType] = useState<string>('moderator');
  const [statusMsg, setStatusMsg] = useState('');

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => setStatusMsg(''), 3000);
  };

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
        expiresAt: banExpiresAt ? new Date(banExpiresAt).toISOString() : undefined,
      });
    },
    onSuccess: () => {
      setBanUserId('');
      setBanReason('');
      setBanExpiresAt('');
      void qc.invalidateQueries({ queryKey: ['community-bans', communityId] });
      showStatus('Member banned');
    },
    onError: () => showStatus('Failed to ban member'),
  });

  const unbanMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/creators/me/communities/${communityId}/bans/${userId}/remove`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community-bans', communityId] });
      showStatus('Ban removed');
    },
    onError: () => showStatus('Failed to unban'),
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
      showStatus('Role assigned');
    },
    onError: () => showStatus('Failed to assign role'),
  });

  const removeRoleMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/creators/me/communities/${communityId}/roles/${userId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community-roles', communityId] });
      showStatus('Role removed');
    },
    onError: () => showStatus('Failed to remove role'),
  });

  const resolveReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await api.patch(`/creators/me/communities/${communityId}/reports/${reportId}/resolve`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community-reports', communityId] });
      showStatus('Report resolved');
    },
    onError: () => showStatus('Failed to resolve report'),
  });

  return (
    <div className="space-y-8">
      {statusMsg ? (
        <p className="rounded-lg bg-primary/10 px-4 py-2 text-sm text-primary">{statusMsg}</p>
      ) : null}

      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h3 className="font-label-caps text-outline">Ban member</h3>
        <SubscriberPicker
          value={banUserId}
          onChange={setBanUserId}
          placeholder="Search subscribers by name or username"
        />
        <Input
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
          placeholder="Reason (optional)"
        />
        <label className="block text-xs text-on-surface-variant">Expires at (optional)</label>
        <Input
          type="datetime-local"
          value={banExpiresAt}
          onChange={(e) => setBanExpiresAt(e.target.value)}
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
                {b.expiresAt ? ` (until ${new Date(b.expiresAt).toLocaleString()})` : ''}
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
        <p className="text-xs text-on-surface-variant">
          Coaches can view and resolve reports only.
        </p>
        <SubscriberPicker
          value={roleUserId}
          onChange={setRoleUserId}
          placeholder="Search member to assign role"
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
                <p className="font-medium">
                  <span className="mr-2 text-xs uppercase text-outline">
                    {r.targetType ?? 'message'}
                  </span>
                  {r.reason}
                </p>
                <ReportPreview communityId={communityId} report={r} />
                <p className="mt-1 text-xs text-outline">
                  {new Date(r.createdAt).toLocaleString()}
                </p>
                <Button
                  variant="ghost"
                  className="mt-2 text-xs"
                  disabled={resolveReportMutation.isPending}
                  onClick={() => resolveReportMutation.mutate(r.id)}
                >
                  Resolve
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
