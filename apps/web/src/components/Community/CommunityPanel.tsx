'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button, EmptyState, Icon, Input } from '@forge/design-system';
import { ChannelType } from '@forge/shared-types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAccessSession } from '@/lib/access-session';
import { getSocket } from '@/lib/socket';
import { SocketEvents } from '@forge/shared-types';
import { MembershipPanel } from '@/components/Membership/MembershipPanel';

type ChannelAccess = { allowed: boolean; reason?: string | null };

type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

type Channel = {
  id: string;
  name: string;
  slug: string;
  type: string;
  categoryId?: string | null;
  access?: ChannelAccess;
};

type ChannelMessage = {
  id: string;
  channelId: string;
  userId: string;
  user?: { displayName?: string; username?: string };
  body: string;
  createdAt: string;
  deletedAt?: string | null;
};

type CommunityPayload = {
  community: {
    id: string;
    creatorId: string;
    name: string;
    slug: string;
  } | null;
  categories: Category[];
  channels: Channel[];
};

interface Props {
  creatorId: string;
  communitySlug?: string;
}

function isChannelMessage(value: unknown): value is ChannelMessage {
  if (!value || typeof value !== 'object') return false;
  const msg = value as ChannelMessage;
  return typeof msg.id === 'string' && typeof msg.body === 'string';
}

function accessLabel(reason?: string | null): string {
  if (reason === 'tier_required') return 'A higher membership tier is required';
  if (reason === 'subscription_required') return 'Membership required to access this channel';
  if (reason === 'invite_required') return 'This channel is invite-only';
  return 'You do not have access to this channel';
}

export function CommunityPanel({ creatorId, communitySlug }: Props) {
  const { user, accessToken } = useAuth();
  const qc = useQueryClient();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [view, setView] = useState<'chat' | 'posts'>('chat');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isCreator = user?.id === creatorId;

  const communityPath = communitySlug
    ? `/creators/${creatorId}/communities/${communitySlug}`
    : `/communities/${creatorId}`;

  const { data: communityData } = useQuery({
    queryKey: ['community', creatorId, communitySlug ?? 'default'],
    queryFn: async () => {
      const { data } = await api.get<{ data: CommunityPayload }>(communityPath);
      return data.data;
    },
  });

  const communityId = communityData?.community?.id;
  const channels = communityData?.channels ?? [];
  const categories = communityData?.categories ?? [];

  const { data: postsData } = useQuery({
    queryKey: ['community-posts', communityId],
    enabled: !!communityId && view === 'posts',
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          data: Array<{
            id: string;
            title?: string | null;
            body: string;
            postType: string;
            isPinned: boolean;
            author?: { displayName?: string };
          }>;
        };
      }>(`/communities/${communityId}/posts`);
      return data.data.data;
    },
  });

  const hasPremiumChannel = useMemo(
    () =>
      channels.some(
        (ch) =>
          ch.type === ChannelType.SUBSCRIBERS ||
          ch.type === ChannelType.TIER ||
          ch.type === 'subscribers' ||
          ch.type === 'tier',
      ),
    [channels],
  );

  const needsSession =
    !!user &&
    !isCreator &&
    hasPremiumChannel &&
    !!activeChannelId &&
    channels.find((c) => c.id === activeChannelId)?.type !== ChannelType.PUBLIC &&
    channels.find((c) => c.id === activeChannelId)?.type !== 'public';

  const { ready: sessionReady, conflict, takeOver } = useAccessSession(
    'community',
    communityId,
    !!needsSession,
  );

  useEffect(() => {
    if (!activeChannelId && channels.length > 0) {
      const firstAccessible = channels.find((ch) => ch.access?.allowed !== false);
      setActiveChannelId((firstAccessible ?? channels[0]).id);
    }
  }, [activeChannelId, channels]);

  const activeChannel = channels.find((ch) => ch.id === activeChannelId);
  const channelAccessible = activeChannel?.access?.allowed !== false && (!needsSession || sessionReady);

  const messagesQueryKey = ['channel-messages', activeChannelId] as const;

  const { data: messages, error: messagesError } = useQuery({
    queryKey: messagesQueryKey,
    enabled: !!activeChannelId && channelAccessible,
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: ChannelMessage[] } }>(
        `/channels/${activeChannelId}/messages`,
      );
      return data.data.data;
    },
  });

  const messageList = messages ?? [];
  const accessDenied =
    !channelAccessible ||
    (messagesError &&
      typeof messagesError === 'object' &&
      'response' in messagesError &&
      (messagesError as { response?: { status?: number } }).response?.status === 403);

  const virtualizer = useVirtualizer({
    count: messageList.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 8,
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

  const markDeleted = useCallback(
    (messageId: string) => {
      qc.setQueryData<ChannelMessage[]>(messagesQueryKey, (prev) =>
        (prev ?? []).map((m) =>
          m.id === messageId ? { ...m, body: '[deleted]', deletedAt: new Date().toISOString() } : m,
        ),
      );
    },
    [qc, messagesQueryKey],
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

  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await api.delete(`/channels/${activeChannelId}/messages/${messageId}`);
      return messageId;
    },
    onSuccess: (messageId) => markDeleted(messageId),
  });

  const reportMutation = useMutation({
    mutationFn: async ({ messageId, reason }: { messageId: string; reason: string }) => {
      if (!communityId || !activeChannelId) return;
      await api.post(`/communities/${communityId}/reports`, {
        channelId: activeChannelId,
        messageId,
        reason,
      });
    },
    onSuccess: () => setReportingId(null),
  });

  useEffect(() => {
    if (!activeChannelId || !accessToken || !channelAccessible) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    socket.emit('join-channel', { channelId: activeChannelId });
    const onMessage = (payload: unknown) => {
      if (isChannelMessage(payload)) appendMessage(payload);
    };
    const onDelete = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as { channelId?: string; messageId?: string };
      if (p.channelId !== activeChannelId || !p.messageId) return;
      markDeleted(p.messageId);
    };
    socket.on(SocketEvents.CHANNEL_MESSAGE, onMessage);
    socket.on(SocketEvents.CHANNEL_MESSAGE_DELETE, onDelete);

    return () => {
      socket.emit('leave-channel', { channelId: activeChannelId });
      socket.off(SocketEvents.CHANNEL_MESSAGE, onMessage);
      socket.off(SocketEvents.CHANNEL_MESSAGE_DELETE, onDelete);
    };
  }, [accessToken, activeChannelId, appendMessage, markDeleted, channelAccessible]);

  useEffect(() => {
    if (messageList.length > 0) {
      virtualizer.scrollToIndex(messageList.length - 1, { align: 'end' });
    }
  }, [messageList.length, virtualizer]);

  const channelsByCategory = useMemo(() => {
    const uncategorized: Channel[] = [];
    const byCat = new Map<string, Channel[]>();
    for (const ch of channels) {
      if (ch.categoryId) {
        const list = byCat.get(ch.categoryId) ?? [];
        list.push(ch);
        byCat.set(ch.categoryId, list);
      } else {
        uncategorized.push(ch);
      }
    }
    return { uncategorized, byCat, categories };
  }, [channels, categories]);

  const renderChannelButton = (ch: Channel) => {
    const locked = ch.access?.allowed === false;
    return (
      <li key={ch.id}>
        <button
          type="button"
          onClick={() => setActiveChannelId(ch.id)}
          className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm ${
            activeChannelId === ch.id
              ? 'bg-primary/15 text-primary'
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          {locked ? <Icon name="lock" className="text-xs opacity-60" /> : null}
          <span className="truncate">{ch.name}</span>
        </button>
      </li>
    );
  };

  if (!communityData?.community) {
    return (
      <EmptyState
        title="No community yet"
        description="This creator has not set up a community yet."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setView('chat')}
          className={`rounded-full px-4 py-1.5 text-sm ${view === 'chat' ? 'bg-primary text-on-primary' : 'bg-surface-container-high'}`}
        >
          Channels
        </button>
        <button
          type="button"
          onClick={() => setView('posts')}
          className={`rounded-full px-4 py-1.5 text-sm ${view === 'posts' ? 'bg-primary text-on-primary' : 'bg-surface-container-high'}`}
        >
          Posts
        </button>
      </div>
      {view === 'posts' ? (
        <div className="glass-panel space-y-3 rounded-xl p-4">
          {(postsData ?? []).length === 0 ? (
            <p className="text-sm text-on-surface-variant">No community posts yet.</p>
          ) : (
            (postsData ?? []).map((p) => (
              <article key={p.id} className="border-b border-outline-variant/30 pb-3 last:border-0">
                {p.isPinned ? (
                  <span className="text-[10px] font-label-caps text-primary">Pinned</span>
                ) : null}
                {p.title ? <h3 className="font-semibold">{p.title}</h3> : null}
                <p className="text-sm text-on-surface-variant">{p.body}</p>
                <p className="mt-1 text-xs text-outline">
                  {p.author?.displayName ?? 'Creator'} · {p.postType}
                </p>
              </article>
            ))
          )}
        </div>
      ) : (
    <div className="glass-panel flex min-h-[480px] overflow-hidden rounded-xl">
      <aside className="w-48 shrink-0 border-r border-outline-variant/30 bg-surface-container-low p-3">
        <p className="mb-1 text-xs font-label-caps text-outline">Channels</p>
        <p className="mb-3 truncate text-xs text-on-surface-variant">{communityData.community.name}</p>
        <ul className="space-y-1">
          {channelsByCategory.categories.map((cat) => {
            const catChannels = channelsByCategory.byCat.get(cat.id) ?? [];
            if (catChannels.length === 0) return null;
            return (
              <li key={cat.id} className="mb-2">
                <p className="mb-1 px-2 text-[10px] font-label-caps uppercase text-outline">{cat.name}</p>
                <ul className="space-y-0.5">{catChannels.map(renderChannelButton)}</ul>
              </li>
            );
          })}
          {channelsByCategory.uncategorized.map((ch) => renderChannelButton(ch))}
        </ul>
      </aside>
      <div className="flex flex-1 flex-col">
        {conflict ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-sm text-on-surface-variant">{conflict}</p>
            <Button onClick={takeOver}>Use this device</Button>
          </div>
        ) : accessDenied ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <Icon name="lock" className="text-3xl text-outline" />
            <p className="text-sm text-on-surface-variant">
              {accessLabel(activeChannel?.access?.reason)}
            </p>
            {!isCreator ? <MembershipPanel creatorId={creatorId} /> : null}
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((item) => {
                  const m = messageList[item.index];
                  const canDelete = user && (m.userId === user.id || isCreator);
                  const canReport = user && m.userId !== user.id && !m.deletedAt;
                  return (
                    <div
                      key={m.id}
                      className="absolute left-0 top-0 w-full text-sm"
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      <div className="flex items-start justify-between gap-2 py-1">
                        <div>
                          <span className="font-medium">{m.user?.displayName ?? 'Member'}</span>
                          <span className="text-on-surface-variant"> · </span>
                          <span className={m.deletedAt ? 'italic text-outline' : ''}>{m.body}</span>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {canReport ? (
                            reportingId === m.id ? (
                              <form
                                className="flex gap-1"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const fd = new FormData(e.currentTarget);
                                  const reason = String(fd.get('reason') ?? '').trim();
                                  if (!reason) return;
                                  reportMutation.mutate({ messageId: m.id, reason });
                                }}
                              >
                                <Input name="reason" placeholder="Reason" className="h-7 w-24 text-xs" />
                                <Button type="submit" className="px-2 py-0 text-xs">
                                  Report
                                </Button>
                              </form>
                            ) : (
                              <Button
                                variant="ghost"
                                className="px-2 py-0 text-xs text-outline"
                                onClick={() => setReportingId(m.id)}
                              >
                                Report
                              </Button>
                            )
                          ) : null}
                          {canDelete && !m.deletedAt ? (
                            <Button
                              variant="ghost"
                              className="px-2 py-0 text-xs text-error"
                              onClick={() => {
                                if (window.confirm('Delete this message?')) {
                                  deleteMutation.mutate(m.id);
                                }
                              }}
                            >
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Message channel…"
                  className="flex-1"
                />
                <Button type="submit" disabled={sendMutation.isPending}>
                  Send
                </Button>
              </form>
            ) : (
              <p className="border-t border-outline-variant/30 p-3 text-xs text-on-surface-variant">
                Sign in to post in community channels.
              </p>
            )}
          </>
        )}
      </div>
    </div>
      )}
    </div>
  );
}
