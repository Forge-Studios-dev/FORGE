'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import { SocketEvents } from '@forge/shared-types';

type Channel = {
  id: string;
  name: string;
  slug: string;
  type: string;
};

type ChannelMessage = {
  id: string;
  channelId: string;
  userId: string;
  user?: { displayName?: string; username?: string };
  body: string;
  createdAt: string;
};

interface Props {
  creatorId: string;
}

function isChannelMessage(value: unknown): value is ChannelMessage {
  if (!value || typeof value !== 'object') return false;
  const msg = value as ChannelMessage;
  return typeof msg.id === 'string' && typeof msg.body === 'string';
}

export function CommunityPanel({ creatorId }: Props) {
  const { user, accessToken } = useAuth();
  const qc = useQueryClient();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: communityData } = useQuery({
    queryKey: ['community', creatorId],
    queryFn: async () => {
      const { data } = await api.get<{
        data: { community: { id: string } | null; channels: Channel[] };
      }>(`/communities/${creatorId}`);
      return data.data;
    },
  });

  const channels = communityData?.channels ?? [];

  useEffect(() => {
    if (!activeChannelId && channels.length > 0) {
      setActiveChannelId(channels[0].id);
    }
  }, [activeChannelId, channels]);

  const messagesQueryKey = ['channel-messages', activeChannelId] as const;

  const { data: messages } = useQuery({
    queryKey: messagesQueryKey,
    enabled: !!activeChannelId,
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: ChannelMessage[] } }>(
        `/channels/${activeChannelId}/messages`,
      );
      return data.data.data;
    },
  });

  const appendMessage = useCallback(
    (message: ChannelMessage) => {
      if (!activeChannelId || message.channelId !== activeChannelId) return;
      qc.setQueryData<ChannelMessage[]>(messagesQueryKey, (prev) => {
        const list = prev ?? [];
        if (list.some((m) => m.id === message.id)) return list;
        return [...list, message];
      });
    },
    [activeChannelId, qc, messagesQueryKey],
  );

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      const { data } = await api.post<{ data: ChannelMessage }>(
        `/channels/${activeChannelId}/messages`,
        { body },
      );
      return data.data;
    },
    onSuccess: (message) => {
      setText('');
      if (message) appendMessage(message);
    },
  });

  useEffect(() => {
    if (!activeChannelId || !accessToken) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    socket.emit('join-channel', { channelId: activeChannelId });
    const onMessage = (payload: unknown) => {
      if (isChannelMessage(payload)) {
        appendMessage(payload);
      }
    };
    socket.on(SocketEvents.CHANNEL_MESSAGE, onMessage);

    return () => {
      socket.emit('leave-channel', { channelId: activeChannelId });
      socket.off(SocketEvents.CHANNEL_MESSAGE, onMessage);
    };
  }, [accessToken, activeChannelId, appendMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  if (!communityData?.community) {
    return (
      <p className="text-sm text-on-surface-variant">This creator has not set up a community yet.</p>
    );
  }

  return (
    <div className="glass-panel flex min-h-[480px] overflow-hidden rounded-xl">
      <aside className="w-48 shrink-0 border-r border-outline-variant/30 bg-surface-container-low p-3">
        <p className="mb-3 text-xs font-label-caps text-outline">Channels</p>
        <ul className="space-y-1">
          {channels.map((ch) => (
            <li key={ch.id}>
              <button
                type="button"
                onClick={() => setActiveChannelId(ch.id)}
                className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${
                  activeChannelId === ch.id
                    ? 'bg-primary/15 text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {ch.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="flex flex-1 flex-col">
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {(messages ?? []).map((m) => (
            <div key={m.id} className="text-sm">
              <span className="font-medium">{m.user?.displayName ?? 'Member'}</span>
              <span className="text-on-surface-variant"> · </span>
              <span>{m.body}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {user && activeChannelId ? (
          <form
            className="flex gap-2 border-t border-outline-variant/30 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const body = text.trim();
              if (!body) return;
              sendMutation.mutate(body);
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message channel…"
              className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={sendMutation.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-40"
            >
              Send
            </button>
          </form>
        ) : (
          <p className="border-t border-outline-variant/30 p-3 text-xs text-on-surface-variant">
            Sign in to post in community channels.
          </p>
        )}
      </div>
    </div>
  );
}
