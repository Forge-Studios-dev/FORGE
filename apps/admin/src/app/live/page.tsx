'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, PageHeader } from '@forge/design-system';
import { ConfirmDialog, useToast } from '@forge/design-system/client';
import { api } from '@/lib/api';

type AdminStream = {
  id: string;
  title: string;
  status: string;
  visibility: string;
  creatorName?: string;
  viewerCount: number;
  scheduledAt?: string | null;
  startedAt?: string | null;
};

type ChatMessage = {
  id: string;
  body: string;
  userId: string;
  user?: { displayName?: string; username?: string };
  createdAt: string;
};

export default function AdminLivePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [grantStreamId, setGrantStreamId] = useState<string | null>(null);
  const [grantUsername, setGrantUsername] = useState('');
  const [grantNote, setGrantNote] = useState('');
  const [chatStreamId, setChatStreamId] = useState<string | null>(null);
  const [forceEndTarget, setForceEndTarget] = useState<{ id: string; title: string } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-streams'],
    queryFn: async () => {
      const { data: res } = await api.get<{
        data: AdminStream[];
        meta?: unknown;
      }>('/admin/streams?limit=50');
      return res.data;
    },
    refetchInterval: (q) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
      const streams = q.state.data ?? [];
      const hasLive = streams.some((s) => s.status === 'live' || s.status === 'idle');
      // No admin socket client yet — slow safety poll only while something is active.
      return hasLive ? 90_000 : 180_000;
    },
  });

  const { data: chatData, refetch: refetchChat } = useQuery({
    queryKey: ['admin-stream-chat', chatStreamId],
    enabled: !!chatStreamId,
    queryFn: async () => {
      const { data: res } = await api.get<{
        data: { data: ChatMessage[] };
      }>(`/admin/streams/${chatStreamId}/chat?limit=80`);
      return res.data.data;
    },
    refetchInterval: () => {
      if (!chatStreamId) return false;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
      return 90_000;
    },
  });

  const forceEnd = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/admin/streams/${id}/force-end`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-streams'] });
      toast({ title: 'Stream ended', variant: 'success' });
      setForceEndTarget(null);
    },
    onError: () => {
      toast({ title: 'Could not end stream', variant: 'critical' });
      setForceEndTarget(null);
    },
  });

  const grantAccess = useMutation({
    mutationFn: async ({
      streamId,
      username,
      note,
    }: {
      streamId: string;
      username: string;
      note?: string;
    }) => {
      await api.post(`/admin/streams/${streamId}/grant-access`, {
        username: username.replace(/^@/, ''),
        note,
      });
    },
    onSuccess: () => {
      setGrantStreamId(null);
      setGrantUsername('');
      setGrantNote('');
      qc.invalidateQueries({ queryKey: ['admin-streams'] });
      toast({ title: 'Access granted', variant: 'success' });
    },
    onError: () => toast({ title: 'Could not grant access', variant: 'critical' }),
  });

  const deleteChatMessage = useMutation({
    mutationFn: async ({ streamId, messageId }: { streamId: string; messageId: string }) => {
      await api.delete(`/admin/streams/${streamId}/chat/${messageId}`);
    },
    onSuccess: () => void refetchChat(),
    onError: () => toast({ title: 'Could not delete message', variant: 'critical' }),
  });

  const backfillMux = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { updated: number } }>(
        '/admin/streams/backfill-mux-playback-ids',
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-streams'] });
    },
    onError: () => toast({ title: 'Backfill failed', variant: 'critical' }),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Live streams"
        subtitle="Monitor sessions, moderate chat, force-end streams, grant access by username, and backfill Mux playback IDs."
      />
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={backfillMux.isPending}
          onClick={() => backfillMux.mutate()}
        >
          {backfillMux.isPending ? 'Backfilling…' : 'Backfill Mux playback IDs'}
        </Button>
        {backfillMux.data != null ? (
          <p className="mt-2 text-xs text-on-surface-variant">
            Updated {backfillMux.data.updated} stream(s)
          </p>
        ) : null}
      </div>
      {chatStreamId ? (
        <div className="glass-panel mb-6 rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-medium">Chat moderation</p>
            <Button type="button" variant="ghost" className="!px-2 !py-1 text-sm" onClick={() => setChatStreamId(null)}>
              Close
            </Button>
          </div>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {(chatData ?? []).map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-2 border-b border-outline-variant/10 pb-2">
                <span>
                  <span className="font-medium">
                    {m.user?.displayName ?? m.user?.username ?? m.userId}:
                  </span>{' '}
                  {m.body}
                </span>
                {m.body !== '[deleted]' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={deleteChatMessage.isPending}
                    className="!shrink-0 !px-1 !py-0 text-xs text-error"
                    onClick={() =>
                      deleteChatMessage.mutate({ streamId: chatStreamId, messageId: m.id })
                    }
                  >
                    Delete
                  </Button>
                ) : null}
              </li>
            ))}
            {!chatData?.length ? (
              <li className="text-on-surface-variant">No messages yet.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
      {isError ? (
        <div className="glass-panel flex flex-col items-center rounded-xl px-6 py-12 text-center">
          <p className="text-error">Failed to load streams.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <ul className="space-y-3" aria-busy="true" aria-label="Loading streams">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="glass-panel animate-pulse rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <div className="h-4 w-48 rounded bg-surface-container-high" />
                  <div className="h-3 w-64 rounded bg-surface-container-high" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-20 rounded-lg bg-surface-container-high" />
                  <div className="h-8 w-20 rounded-lg bg-surface-container-high" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : !data?.length ? (
        <p className="text-on-surface-variant">No streams found.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((s) => (
            <li key={s.id} className="glass-panel rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-on-surface-variant">
                    {s.creatorName ?? 'Creator'} · {s.status} · {s.visibility}
                    {s.viewerCount ? ` · ${s.viewerCount} viewers` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.status === 'live' ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="!px-3 !py-1.5 text-sm"
                      onClick={() => setChatStreamId(chatStreamId === s.id ? null : s.id)}
                    >
                      {chatStreamId === s.id ? 'Hide chat' : 'View chat'}
                    </Button>
                  ) : null}
                  {s.visibility === 'paid_event' ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="!px-3 !py-1.5 text-sm text-primary"
                      onClick={() => setGrantStreamId(grantStreamId === s.id ? null : s.id)}
                    >
                      Grant access
                    </Button>
                  ) : null}
                  {s.status !== 'ended' ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={forceEnd.isPending}
                      className="!px-3 !py-1.5 text-sm text-error"
                      onClick={() => setForceEndTarget({ id: s.id, title: s.title })}
                    >
                      Force end
                    </Button>
                  ) : null}
                </div>
              </div>
              {grantStreamId === s.id ? (
                <form
                  className="mt-4 flex flex-col gap-2 border-t border-outline-variant/20 pt-4 sm:flex-row sm:items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!grantUsername.trim()) return;
                    grantAccess.mutate({
                      streamId: s.id,
                      username: grantUsername.trim(),
                      note: grantNote.trim() || undefined,
                    });
                  }}
                >
                  <label className="flex flex-1 flex-col gap-1 text-xs">
                    Username
                    <input
                      value={grantUsername}
                      onChange={(e) => setGrantUsername(e.target.value)}
                      placeholder="@viewer"
                      className="rounded-lg border border-outline-variant/40 bg-surface-container-high px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-xs">
                    Note (optional)
                    <input
                      value={grantNote}
                      onChange={(e) => setGrantNote(e.target.value)}
                      placeholder="Audit note"
                      className="rounded-lg border border-outline-variant/40 bg-surface-container-high px-3 py-2 text-sm"
                    />
                  </label>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={grantAccess.isPending || !grantUsername.trim()}
                  >
                    {grantAccess.isPending ? 'Granting…' : 'Grant'}
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={forceEndTarget !== null}
        title={`End "${forceEndTarget?.title ?? ''}" for all current viewers?`}
        confirmLabel="Force end"
        variant="danger"
        loading={forceEnd.isPending}
        onConfirm={() => forceEndTarget && forceEnd.mutate(forceEndTarget.id)}
        onCancel={() => setForceEndTarget(null)}
      />
    </div>
  );
}
