'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import { SocketEvents } from '@forge/shared-types';

type ChatMessage = {
  id: string;
  streamId: string;
  userId: string;
  user?: { displayName?: string; username?: string };
  body: string;
  createdAt: string;
};

interface Props {
  streamId: string;
  streamOwnerId?: string;
  chatEnabled?: boolean;
  slowModeSeconds?: number;
}

export function StreamChatPanel({
  streamId,
  streamOwnerId,
  chatEnabled = true,
  slowModeSeconds = 0,
}: Props) {
  const { user, accessToken } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [slowMode, setSlowMode] = useState(slowModeSeconds);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isMod = !!user && (user.id === streamOwnerId || user.role === 'admin');

  const { data, isLoading } = useQuery({
    queryKey: ['stream-chat', streamId],
    enabled: chatEnabled && streamId.length > 0,
    queryFn: async () => {
      const { data: res } = await api.get<{ data: { data: ChatMessage[] } }>(
        `/streams/${streamId}/chat`,
      );
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      await api.post(`/streams/${streamId}/chat`, { body });
    },
    onSuccess: () => {
      setText('');
      void qc.invalidateQueries({ queryKey: ['stream-chat', streamId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await api.delete(`/streams/${streamId}/chat/${messageId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stream-chat', streamId] }),
  });

  const slowModeMutation = useMutation({
    mutationFn: async (seconds: number) => {
      await api.patch(`/streams/${streamId}/slow-mode`, { slowModeSeconds: seconds });
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
    if (!chatEnabled || !accessToken) return;
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

    socket.on(SocketEvents.STREAM_CHAT_MESSAGE, onMessage);
    socket.on(SocketEvents.STREAM_CHAT_DELETE, onDelete);
    socket.on(SocketEvents.STREAM_CHAT_SLOW_MODE, onSlowMode);

    return () => {
      socket.emit('leave-stream-chat', { streamId });
      socket.off(SocketEvents.STREAM_CHAT_MESSAGE, onMessage);
      socket.off(SocketEvents.STREAM_CHAT_DELETE, onDelete);
      socket.off(SocketEvents.STREAM_CHAT_SLOW_MODE, onSlowMode);
    };
  }, [accessToken, appendMessage, chatEnabled, qc, streamId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.length]);

  if (!chatEnabled) {
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
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => slowModeMutation.mutate(slowMode > 0 ? 0 : 10)}
              className="rounded px-2 py-0.5 text-xs text-on-surface-variant hover:bg-surface-container-high"
            >
              Slow mode {slowMode > 0 ? 'on' : 'off'}
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <p className="text-sm text-on-surface-variant">Loading chat…</p>
        ) : !data?.length ? (
          <p className="text-sm text-on-surface-variant">Be the first to say hello.</p>
        ) : (
          data.map((m) => (
            <div key={m.id} className="group flex items-start justify-between gap-2 text-sm">
              <div>
                <span className="font-medium text-primary">
                  {m.user?.displayName ?? m.user?.username ?? 'Viewer'}
                </span>
                <span className="text-on-surface-variant"> · </span>
                <span>{m.body}</span>
              </div>
              {isMod && m.body !== '[deleted]' ? (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(m.id)}
                  className="hidden text-xs text-error group-hover:inline"
                >
                  Delete
                </button>
              ) : null}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      {user ? (
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
            type="submit"
            disabled={sendMutation.isPending || !text.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-40"
          >
            Send
          </button>
        </form>
      ) : (
        <p className="border-t border-outline-variant/30 p-3 text-xs text-on-surface-variant">
          Sign in to chat.
        </p>
      )}
    </div>
  );
}
