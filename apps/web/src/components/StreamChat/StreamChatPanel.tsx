'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import { SocketEvents } from '@forge/shared-types';

type ChatMode = 'all' | 'followers' | 'subscribers' | 'mods_only';

type ChatMessage = {
  id: string;
  streamId: string;
  userId: string;
  user?: { displayName?: string; username?: string };
  body: string;
  createdAt: string;
  messageType?: string;
  amountCents?: number | null;
};

interface Props {
  streamId: string;
  streamOwnerId?: string;
  chatEnabled?: boolean;
  chatMode?: ChatMode;
  slowModeSeconds?: number;
  pinnedMessageId?: string | null;
}

const SLOW_PRESETS = [0, 5, 10, 30];
const SUPER_AMOUNTS = [200, 500, 1000, 2000];

const CHAT_MODE_LABELS: Record<ChatMode, string> = {
  all: 'Everyone can chat',
  followers: 'Subscribers-only chat',
  subscribers: 'Members-only chat',
  mods_only: 'Moderators-only chat',
};

export function StreamChatPanel({
  streamId,
  streamOwnerId,
  chatEnabled = true,
  chatMode = 'all',
  slowModeSeconds = 0,
  pinnedMessageId,
}: Props) {
  const { user, accessToken } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [slowMode, setSlowMode] = useState(slowModeSeconds);
  const [pinnedId, setPinnedId] = useState<string | null>(pinnedMessageId ?? null);
  const [mode, setMode] = useState<ChatMode>(chatMode);
  const [enabled, setEnabled] = useState(chatEnabled);
  const [unbanUsername, setUnbanUsername] = useState('');
  const [showSuperChat, setShowSuperChat] = useState(false);
  const [superAmount, setSuperAmount] = useState(500);
  const [superText, setSuperText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: modStatus } = useQuery({
    queryKey: ['stream-mod-status', streamId],
    enabled: !!user && streamId.length > 0,
    queryFn: async () => {
      const { data } = await api.get<{ data: { isMod: boolean } }>(
        `/streams/${streamId}/moderator-status`,
      );
      return data.data;
    },
  });

  const isMod = !!user && (user.id === streamOwnerId || user.role === 'admin' || modStatus?.isMod);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stream-chat', streamId],
    enabled: enabled && streamId.length > 0,
    queryFn: async () => {
      const { data: res } = await api.get<{ data: { data: ChatMessage[] } }>(
        `/streams/${streamId}/chat`,
      );
      return res.data.data;
    },
    retry: 1,
  });

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      await api.post(`/streams/${streamId}/chat`, { body });
    },
    onSuccess: () => {
      setText('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await api.delete(`/streams/${streamId}/chat/${messageId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stream-chat', streamId] }),
  });

  const timeoutMutation = useMutation({
    mutationFn: async (target: { userId?: string; username?: string }) => {
      await api.post(`/streams/${streamId}/chat/timeout`, {
        ...target,
        durationSeconds: 300,
      });
    },
  });

  const banMutation = useMutation({
    mutationFn: async (target: { userId?: string; username?: string }) => {
      await api.post(`/streams/${streamId}/chat/ban`, target);
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async (username: string) => {
      await api.post(`/streams/${streamId}/chat/unban`, {
        targetUsername: username.replace(/^@/, ''),
      });
    },
    onSuccess: () => setUnbanUsername(''),
  });

  const pinMutation = useMutation({
    mutationFn: async (messageId: string | null) => {
      await api.patch(`/streams/${streamId}/chat/pin`, { messageId });
    },
    onSuccess: (_, messageId) => setPinnedId(messageId),
  });

  const superChatMutation = useMutation({
    mutationFn: async () => {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      await api.post(`/streams/${streamId}/chat/super-chat`, {
        body: superText.trim(),
        amountCents: superAmount,
        successUrl: `${origin}/live/${streamId}?super=success`,
        cancelUrl: `${origin}/live/${streamId}?super=cancel`,
      });
    },
    onSuccess: () => {
      setSuperText('');
      setShowSuperChat(false);
      void qc.invalidateQueries({ queryKey: ['stream-chat', streamId] });
    },
  });

  const slowModeMutation = useMutation({
    mutationFn: async (seconds: number) => {
      await api.patch(`/streams/${streamId}/chat/slow-mode`, { slowModeSeconds: seconds });
    },
    onSuccess: (_, seconds) => setSlowMode(seconds),
  });

  const appendMessage = useCallback(
    (msg: ChatMessage) => {
      qc.setQueryData<ChatMessage[]>(['stream-chat', streamId], (prev) => {
        const list = prev ?? [];
        if (list.some((m) => m.id === msg.id)) return list;
        return [...list, msg];
      });
    },
    [qc, streamId],
  );

  useEffect(() => {
    setSlowMode(slowModeSeconds);
  }, [slowModeSeconds]);

  useEffect(() => {
    setPinnedId(pinnedMessageId ?? null);
  }, [pinnedMessageId]);

  useEffect(() => {
    setMode(chatMode);
  }, [chatMode]);

  useEffect(() => {
    setEnabled(chatEnabled);
  }, [chatEnabled]);

  useEffect(() => {
    if (!enabled || !accessToken) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    socket.emit('join-stream-chat', { streamId });
    const onMessage = (msg: ChatMessage) => appendMessage(msg);
    const onDelete = ({ messageId }: { messageId: string }) => {
      qc.setQueryData<ChatMessage[]>(['stream-chat', streamId], (prev) =>
        (prev ?? []).map((m) => (m.id === messageId ? { ...m, body: '[deleted]' } : m)),
      );
    };
    const onSlowMode = ({ slowModeSeconds: s }: { slowModeSeconds: number }) => setSlowMode(s);
    const onPinned = ({ messageId }: { messageId: string | null }) => setPinnedId(messageId);
    const onSettings = (payload: { chatEnabled?: boolean; chatMode?: ChatMode }) => {
      if (payload.chatEnabled !== undefined) setEnabled(payload.chatEnabled);
      if (payload.chatMode) setMode(payload.chatMode);
    };

    socket.on(SocketEvents.STREAM_CHAT_MESSAGE, onMessage);
    socket.on(SocketEvents.STREAM_CHAT_DELETE, onDelete);
    socket.on(SocketEvents.STREAM_CHAT_SLOW_MODE, onSlowMode);
    socket.on(SocketEvents.STREAM_CHAT_PINNED, onPinned);
    socket.on(SocketEvents.STREAM_CHAT_SETTINGS, onSettings);

    return () => {
      socket.emit('leave-stream-chat', { streamId });
      socket.off(SocketEvents.STREAM_CHAT_MESSAGE, onMessage);
      socket.off(SocketEvents.STREAM_CHAT_DELETE, onDelete);
      socket.off(SocketEvents.STREAM_CHAT_SLOW_MODE, onSlowMode);
      socket.off(SocketEvents.STREAM_CHAT_PINNED, onPinned);
      socket.off(SocketEvents.STREAM_CHAT_SETTINGS, onSettings);
    };
  }, [accessToken, appendMessage, enabled, qc, streamId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.length]);

  const pinnedMessage = data?.find((m) => m.id === pinnedId);
  const displayName = (m: ChatMessage) => {
    if (m.user?.username) return `@${m.user.username}`;
    return m.user?.displayName ?? 'Viewer';
  };

  if (!enabled) {
    return (
      <div className="glass-panel rounded-xl p-4 text-sm text-on-surface-variant">
        Chat is disabled for this stream.
      </div>
    );
  }

  return (
    <div className="glass-panel flex h-[420px] flex-col rounded-xl">
      <div className="flex items-center justify-between border-b border-outline-variant/30 px-4 py-3">
        <span className="font-medium">Live chat</span>
        {isMod ? (
          <div className="flex flex-wrap gap-1">
            {SLOW_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => slowModeMutation.mutate(s)}
                className={`rounded px-2 py-0.5 text-xs ${slowMode === s ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                {s === 0 ? 'Off' : `${s}s`}
              </button>
            ))}
          </div>
        ) : slowMode > 0 ? (
          <span className="text-xs text-on-surface-variant">Slow mode {slowMode}s</span>
        ) : null}
      </div>
      {mode !== 'all' ? (
        <div className="border-b border-outline-variant/20 bg-surface-container-high/50 px-4 py-1.5 text-xs text-on-surface-variant">
          {CHAT_MODE_LABELS[mode]}
        </div>
      ) : null}
      {isMod ? (
        <form
          className="flex gap-2 border-b border-outline-variant/20 px-4 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            const username = unbanUsername.trim().replace(/^@/, '');
            if (!username || unbanMutation.isPending) return;
            unbanMutation.mutate(username);
          }}
        >
          <input
            value={unbanUsername}
            onChange={(e) => setUnbanUsername(e.target.value)}
            placeholder="Unban @username"
            className="flex-1 rounded border border-outline-variant/40 bg-surface-container-high px-2 py-1 text-xs"
          />
          <button
            type="submit"
            disabled={unbanMutation.isPending || unbanUsername.trim().length < 2}
            className="rounded bg-surface-container px-2 py-1 text-xs text-on-surface-variant disabled:opacity-50"
          >
            Unban
          </button>
        </form>
      ) : null}
      {pinnedMessage ? (
        <div className="border-b border-primary/20 bg-primary/5 px-4 py-2 text-sm">
          <span className="font-label-caps text-primary">Pinned · </span>
          <span className="font-medium">{displayName(pinnedMessage)}</span>
          <span className="text-on-surface-variant">: {pinnedMessage.body}</span>
        </div>
      ) : null}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <p className="text-sm text-on-surface-variant">Loading chat…</p>
        ) : isError ? (
          <p className="text-sm text-error">Chat is temporarily unavailable.</p>
        ) : !data?.length ? (
          <p className="text-sm text-on-surface-variant">Be the first to say hello.</p>
        ) : (
          data.map((m) => (
            <div
              key={m.id}
              className={`group flex items-start justify-between gap-2 text-sm ${m.messageType === 'super_chat' ? 'rounded-lg border border-warning/40 bg-warning/10 px-2 py-1' : ''}`}
            >
              <div>
                <span className="font-medium text-primary">{displayName(m)}</span>
                {m.messageType === 'super_chat' && m.amountCents ? (
                  <span className="ml-1 text-xs text-warning">
                    ${(m.amountCents / 100).toFixed(2)}
                  </span>
                ) : null}
                <span className="text-on-surface-variant"> · </span>
                <span>{m.body}</span>
              </div>
              {isMod && m.body !== '[deleted]' ? (
                <div className="hidden shrink-0 gap-1 group-hover:flex">
                  <button
                    type="button"
                    onClick={() => pinMutation.mutate(m.id)}
                    className="text-xs text-secondary"
                  >
                    Pin
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(m.id)}
                    className="text-xs text-error"
                  >
                    Del
                  </button>
                  {m.userId !== user?.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          timeoutMutation.mutate({
                            userId: m.userId,
                            username: m.user?.username,
                          })
                        }
                        className="text-xs text-on-surface-variant"
                      >
                        Timeout
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          banMutation.mutate({
                            userId: m.userId,
                            username: m.user?.username,
                          })
                        }
                        className="text-xs text-error"
                      >
                        Ban
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      {user ? (
        <>
          {showSuperChat ? (
            <div className="space-y-2 border-t border-outline-variant/30 p-3">
              <div className="flex flex-wrap gap-1">
                {SUPER_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setSuperAmount(a)}
                    className={`rounded px-2 py-0.5 text-xs ${superAmount === a ? 'bg-warning text-on-warning' : 'text-on-surface-variant'}`}
                  >
                    ${(a / 100).toFixed(0)}
                  </button>
                ))}
              </div>
              <input
                value={superText}
                onChange={(e) => setSuperText(e.target.value)}
                placeholder="Super chat message…"
                maxLength={200}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => superChatMutation.mutate()}
                  disabled={superChatMutation.isPending || !superText.trim()}
                  className="rounded-lg bg-warning px-4 py-2 text-sm font-medium text-on-warning disabled:opacity-40"
                >
                  Send ${(superAmount / 100).toFixed(2)}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSuperChat(false)}
                  className="text-xs text-on-surface-variant"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        <form
          className="flex gap-2 border-t border-outline-variant/30 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const body = text.trim();
            if (!body || sendMutation.isPending) return;
            sendMutation.mutate(body);
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Send a message…"
            maxLength={500}
            className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setShowSuperChat((v) => !v)}
            className="rounded-lg border border-warning/50 px-3 py-2 text-xs text-warning"
          >
            Super
          </button>
          <button
            type="submit"
            disabled={sendMutation.isPending || !text.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-40"
          >
            Send
          </button>
        </form>
        </>
      ) : (
        <p className="border-t border-outline-variant/30 p-3 text-xs text-on-surface-variant">
          Sign in to chat.
        </p>
      )}
    </div>
  );
}
