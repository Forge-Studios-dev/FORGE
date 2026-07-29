'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Stream } from '@/types';

type Snapshot = {
  recordedAt: string;
  concurrentViewers: number;
  chatMessagesPerMin: number;
};

type Analytics = {
  peakViewers: number;
  avgViewers: number;
  currentViewers: number;
  totalChatMessages: number;
  uniqueViewers: number;
  superChatRevenueCents: number;
  ticketRevenueCents: number;
  ticketSalesCount: number;
  totalPollVotes: number;
  durationSeconds: number;
  isLive: boolean;
  snapshots: Snapshot[];
};

type Health = {
  muxStatus: string | null;
  reconnecting: boolean;
  reconnectDeadline: string | null;
  reconnectAttempts: number;
  status: string;
  viewerCount: number;
};

type Moderator = {
  userId: string;
  displayName?: string;
  username?: string;
};

type Props = {
  stream: Stream;
  displayViewers: number;
  broadcastMode?: 'obs' | 'browser' | null;
};

function MiniChart({ snapshots, field }: { snapshots: Snapshot[]; field: keyof Snapshot }) {
  const values = snapshots.map((s) => Number(s[field]) || 0);
  const max = Math.max(...values, 1);
  if (values.length === 0) {
    return <p className="text-xs text-on-surface-variant">Collecting data…</p>;
  }
  return (
    <div className="flex h-12 items-end gap-0.5">
      {values.map((v, i) => (
        <div
          key={`${field}-${i}`}
          className="flex-1 rounded-sm bg-primary/70"
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          title={String(v)}
        />
      ))}
    </div>
  );
}

type ChatMode = 'all' | 'followers' | 'subscribers' | 'mods_only';

const CHAT_MODE_OPTIONS: { value: ChatMode; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'followers', label: 'Followers only' },
  { value: 'subscribers', label: 'Members only' },
  { value: 'mods_only', label: 'Mods only' },
];

export function StreamHostDashboard({ stream, displayViewers, broadcastMode }: Props) {
  const qc = useQueryClient();
  const [modQuery, setModQuery] = useState('');
  const [grantQuery, setGrantQuery] = useState('');
  const [grantNote, setGrantNote] = useState('');
  const [chatEnabled, setChatEnabled] = useState(stream.chatEnabled !== false);
  const [chatMode, setChatMode] = useState<ChatMode>(stream.chatMode ?? 'all');

  const { data: analytics } = useQuery({
    queryKey: ['stream-analytics', stream.id],
    queryFn: async () => {
      const { data } = await api.get<{ data: Analytics }>(
        `/creators/me/streams/${stream.id}/analytics`,
      );
      return data.data;
    },
    refetchInterval: () => {
      if (stream.status !== 'live') return false;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
      // Viewer count comes from socket on the parent; analytics is a slow rollup.
      return 120_000;
    },
    enabled: stream.status !== 'ended',
  });

  const { data: health } = useQuery({
    queryKey: ['stream-health', stream.id],
    queryFn: async () => {
      const { data } = await api.get<{ data: Health }>(
        `/creators/me/streams/${stream.id}/health`,
      );
      return data.data;
    },
    refetchInterval: () => {
      if (stream.status !== 'live') return false;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
      return 90_000;
    },
    enabled: stream.status === 'live',
  });

  const { data: moderators } = useQuery({
    queryKey: ['stream-moderators', stream.id],
    queryFn: async () => {
      const { data } = await api.get<{ data: Moderator[] }>(
        `/streams/${stream.id}/moderators`,
      );
      return data.data;
    },
  });

  const { data: modSuggestions } = useQuery({
    queryKey: ['user-search', modQuery],
    enabled: modQuery.trim().length >= 2,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { id: string; username: string; displayName?: string }[];
      }>(`/users/search?q=${encodeURIComponent(modQuery.trim())}&limit=5`);
      return data.data;
    },
  });

  const { data: grantSuggestions } = useQuery({
    queryKey: ['user-search-grant', grantQuery],
    enabled: grantQuery.trim().length >= 2 && stream.visibility === 'paid_event',
    queryFn: async () => {
      const { data } = await api.get<{
        data: { id: string; username: string; displayName?: string }[];
      }>(`/users/search?q=${encodeURIComponent(grantQuery.trim())}&limit=5`);
      return data.data;
    },
  });

  const addMod = useMutation({
    mutationFn: async (username: string) => {
      await api.post(`/streams/${stream.id}/moderators`, { username });
    },
    onSuccess: () => {
      setModQuery('');
      qc.invalidateQueries({ queryKey: ['stream-moderators', stream.id] });
    },
  });

  const removeMod = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/streams/${stream.id}/moderators/${userId}/remove`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stream-moderators', stream.id] }),
  });

  const grantAccess = useMutation({
    mutationFn: async ({ username, note }: { username: string; note?: string }) => {
      await api.post(`/streams/${stream.id}/grant-access`, { username, note });
    },
    onSuccess: () => {
      setGrantQuery('');
      setGrantNote('');
    },
  });

  const markClip = useMutation({
    mutationFn: async () => {
      await api.post(`/streams/${stream.id}/clips`, {});
    },
  });

  const chatSettings = useMutation({
    mutationFn: async (patch: { chatEnabled?: boolean; chatMode?: ChatMode }) => {
      await api.patch(`/streams/${stream.id}/chat/settings`, patch);
    },
    onSuccess: (_, patch) => {
      if (patch.chatEnabled !== undefined) setChatEnabled(patch.chatEnabled);
      if (patch.chatMode) setChatMode(patch.chatMode);
      qc.invalidateQueries({ queryKey: ['stream', stream.id] });
    },
  });

  const uptime = useMemo(() => {
    if (stream.startedAt && stream.status === 'live') {
      return Math.floor((Date.now() - new Date(stream.startedAt).getTime()) / 1000);
    }
    return analytics?.durationSeconds ?? 0;
  }, [stream.startedAt, stream.status, analytics?.durationSeconds]);

  const uptimeLabel =
    uptime >= 3600
      ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
      : `${Math.floor(uptime / 60)}m`;

  return (
    <div className="space-y-4">
      <div className="glass-panel grid gap-3 rounded-xl p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-on-surface-variant">Viewers</p>
          <p className="text-lg font-semibold">{displayViewers}</p>
        </div>
        <div>
          <p className="text-on-surface-variant">Peak</p>
          <p className="text-lg font-semibold">{analytics?.peakViewers ?? displayViewers}</p>
        </div>
        <div>
          <p className="text-on-surface-variant">Uptime</p>
          <p className="text-lg font-semibold">{uptimeLabel}</p>
        </div>
        <div>
          <p className="text-on-surface-variant">Broadcast</p>
          <p className="text-lg font-semibold capitalize">{broadcastMode ?? 'obs'}</p>
        </div>
        {analytics ? (
          <>
            <div>
              <p className="text-on-surface-variant">Unique viewers</p>
              <p className="font-medium">{analytics.uniqueViewers}</p>
            </div>
            <div>
              <p className="text-on-surface-variant">Chat messages</p>
              <p className="font-medium">{analytics.totalChatMessages}</p>
            </div>
            <div>
              <p className="text-on-surface-variant">Super chat</p>
              <p className="font-medium">${(analytics.superChatRevenueCents / 100).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-on-surface-variant">Ticket sales</p>
              <p className="font-medium">
                {analytics.ticketSalesCount} · ${(analytics.ticketRevenueCents / 100).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-on-surface-variant">Poll votes</p>
              <p className="font-medium">{analytics.totalPollVotes}</p>
            </div>
          </>
        ) : null}
        {health ? (
          <div className="sm:col-span-2">
            <p className="text-on-surface-variant">Stream health</p>
            <p className="font-medium capitalize">
              Mux: {health.muxStatus ?? '—'}
              {health.reconnecting ? ' · reconnecting' : ''}
            </p>
            {health.reconnecting && health.reconnectDeadline ? (
              <p className="text-xs text-error">
                Auto-ends at {new Date(health.reconnectDeadline).toLocaleTimeString()} if your
                connection doesn&apos;t resume. Reconnect now to keep this session alive.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {analytics?.snapshots?.length ? (
        <div className="glass-panel grid gap-4 rounded-xl p-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-on-surface-variant">Viewers (last hour)</p>
            <MiniChart snapshots={analytics.snapshots} field="concurrentViewers" />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-on-surface-variant">Chat / min</p>
            <MiniChart snapshots={analytics.snapshots} field="chatMessagesPerMin" />
          </div>
        </div>
      ) : null}

      {stream.status === 'live' ? (
        <div className="glass-panel rounded-xl p-4 text-sm">
          <p className="mb-2 font-medium">Highlights</p>
          <p className="mb-3 text-xs text-on-surface-variant">
            Mark a 30s clip at the current live moment.
          </p>
          <button
            type="button"
            aria-label="Mark highlight clip at current moment"
            disabled={markClip.isPending}
            onClick={() => markClip.mutate()}
            className="rounded-lg bg-secondary px-4 py-2 text-xs font-medium text-on-secondary disabled:opacity-50"
          >
            {markClip.isPending ? 'Saving…' : 'Mark highlight'}
          </button>
        </div>
      ) : null}

      <div className="glass-panel rounded-xl p-4 text-sm">
        <p className="mb-2 font-medium">Chat settings</p>
        <label className="mb-3 flex items-center gap-2 text-on-surface-variant">
          <input
            type="checkbox"
            checked={chatEnabled}
            disabled={chatSettings.isPending}
            onChange={(e) => {
              const next = e.target.checked;
              setChatEnabled(next);
              chatSettings.mutate({ chatEnabled: next });
            }}
          />
          Chat enabled
        </label>
        <p className="mb-2 text-xs text-on-surface-variant">Who can send messages</p>
        <div className="flex flex-wrap gap-2">
          {CHAT_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={chatSettings.isPending || !chatEnabled}
              onClick={() => {
                setChatMode(opt.value);
                chatSettings.mutate({ chatMode: opt.value });
              }}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                chatMode === opt.value
                  ? 'bg-primary text-on-primary'
                  : 'border border-outline-variant/40 text-on-surface-variant hover:border-primary/30'
              } disabled:opacity-50`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-xl p-4 text-sm">
        <p className="mb-2 font-medium">Moderators</p>
        {moderators?.length ? (
          <ul className="mb-3 space-y-2">
            {moderators.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-2 text-on-surface-variant">
                <span>
                  @{m.username ?? m.displayName ?? m.userId}
                  {m.displayName && m.username ? ` · ${m.displayName}` : ''}
                </span>
                <button
                  type="button"
                  disabled={removeMod.isPending}
                  onClick={() => removeMod.mutate(m.userId)}
                  className="text-xs text-error hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-on-surface-variant">No delegated moderators yet.</p>
        )}
        <div className="relative">
          <input
            value={modQuery}
            onChange={(e) => setModQuery(e.target.value)}
            placeholder="@username to add as mod"
            className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-high px-3 py-2 text-xs"
          />
          {modSuggestions?.length ? (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface-container-high shadow-lg">
              {modSuggestions.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-xs hover:bg-surface-container"
                    onClick={() => addMod.mutate(u.username)}
                  >
                    @{u.username}
                    {u.displayName ? ` · ${u.displayName}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {stream.visibility === 'paid_event' ? (
        <div className="glass-panel rounded-xl p-4 text-sm">
          <p className="mb-2 font-medium">Grant event access</p>
          <p className="mb-3 text-xs text-on-surface-variant">
            Give a viewer access to this paid event by username.
          </p>
          <div className="relative mb-2">
            <input
              value={grantQuery}
              onChange={(e) => setGrantQuery(e.target.value)}
              placeholder="@username"
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-high px-3 py-2 text-xs"
            />
            {grantSuggestions?.length ? (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface-container-high shadow-lg">
                {grantSuggestions.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-xs hover:bg-surface-container"
                      onClick={() => setGrantQuery(u.username)}
                    >
                      @{u.username}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <input
            value={grantNote}
            onChange={(e) => setGrantNote(e.target.value)}
            placeholder="Optional note"
            className="mb-2 w-full rounded-lg border border-outline-variant/40 bg-surface-container-high px-3 py-2 text-xs"
          />
          <button
            type="button"
            disabled={grantAccess.isPending || grantQuery.trim().length < 2}
            onClick={() =>
              grantAccess.mutate({
                username: grantQuery.trim().replace(/^@/, ''),
                note: grantNote.trim() || undefined,
              })
            }
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-on-primary disabled:opacity-50"
          >
            {grantAccess.isPending ? 'Granting…' : 'Grant access'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
