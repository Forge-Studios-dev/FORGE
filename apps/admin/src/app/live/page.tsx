'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
  const [grantStreamId, setGrantStreamId] = useState<string | null>(null);
  const [grantUsername, setGrantUsername] = useState('');
  const [grantNote, setGrantNote] = useState('');
  const [chatStreamId, setChatStreamId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-streams'],
    queryFn: async () => {
      const { data: res } = await api.get<{
        data: AdminStream[];
        meta?: unknown;
      }>('/admin/streams?limit=50');
      return res.data;
    },
    refetchInterval: 60_000,
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
    refetchInterval: chatStreamId ? 60_000 : false,
  });

  const forceEnd = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/admin/streams/${id}/force-end`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-streams'] }),
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
    },
  });

  const deleteChatMessage = useMutation({
    mutationFn: async ({ streamId, messageId }: { streamId: string; messageId: string }) => {
      await api.delete(`/admin/streams/${streamId}/chat/${messageId}`);
    },
    onSuccess: () => void refetchChat(),
  });

  const backfillMux = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { updated: number } }>(
        '/admin/streams/backfill-mux-playback-ids',
      );
      return data.data;
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display-forge mb-2 text-2xl font-bold">Live streams</h1>
      <p className="mb-6 text-sm text-on-surface-variant">
        Monitor sessions, moderate chat, force-end streams, grant access by username, and backfill Mux
        playback IDs.
      </p>
      <div className="mb-6">
        <button
          type="button"
          disabled={backfillMux.isPending}
          onClick={() => backfillMux.mutate()}
          className="rounded-lg border border-outline-variant/40 px-4 py-2 text-sm disabled:opacity-50"
        >
          {backfillMux.isPending ? 'Backfilling…' : 'Backfill Mux playback IDs'}
        </button>
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
            <button
              type="button"
              onClick={() => setChatStreamId(null)}
              className="text-sm text-on-surface-variant hover:underline"
            >
              Close
            </button>
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
                  <button
                    type="button"
                    disabled={deleteChatMessage.isPending}
                    onClick={() =>
                      deleteChatMessage.mutate({ streamId: chatStreamId, messageId: m.id })
                    }
                    className="shrink-0 text-xs text-error hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                ) : null}
              </li>
            ))}
            {!chatData?.length ? (
              <li className="text-on-surface-variant">No messages yet.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
      {isLoading ? (
        <p className="text-on-surface-variant">Loading…</p>
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
                    <button
                      type="button"
                      onClick={() => setChatStreamId(chatStreamId === s.id ? null : s.id)}
                      className="rounded-lg border border-outline-variant/40 px-3 py-1.5 text-sm"
                    >
                      {chatStreamId === s.id ? 'Hide chat' : 'View chat'}
                    </button>
                  ) : null}
                  {s.visibility === 'paid_event' ? (
                    <button
                      type="button"
                      onClick={() => setGrantStreamId(grantStreamId === s.id ? null : s.id)}
                      className="rounded-lg border border-primary/40 px-3 py-1.5 text-sm text-primary"
                    >
                      Grant access
                    </button>
                  ) : null}
                  {s.status !== 'ended' ? (
                    <button
                      type="button"
                      disabled={forceEnd.isPending}
                      onClick={() => forceEnd.mutate(s.id)}
                      className="rounded-lg border border-error/40 px-3 py-1.5 text-sm text-error disabled:opacity-50"
                    >
                      Force end
                    </button>
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
                  <button
                    type="submit"
                    disabled={grantAccess.isPending || !grantUsername.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50"
                  >
                    {grantAccess.isPending ? 'Granting…' : 'Grant'}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
