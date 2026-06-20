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
import { AccessSessionConflict } from '@/components/Community/AccessSessionConflict';
import { CommunityPostMedia } from '@/components/Community/CommunityPostMedia';
import type { CommunityChannel, CommunityCategory, CommunityPayload, CommunityPoll } from '@/types/community';
import { isAxiosError } from 'axios';

type ChannelMessage = {
  id: string;
  channelId: string;
  userId: string;
  user?: { displayName?: string; username?: string };
  body: string;
  parentId?: string | null;
  createdAt: string;
  deletedAt?: string | null;
};

type Channel = CommunityChannel;
type Category = CommunityCategory;

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
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [view, setView] = useState<'chat' | 'posts' | 'polls' | 'leaderboard'>('chat');
  const [replyTo, setReplyTo] = useState<ChannelMessage | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isCreator = user?.id === creatorId;

  const communityPath = communitySlug
    ? `/creators/${creatorId}/communities/${communitySlug}`
    : `/communities/${creatorId}`;

  const { data: communityData, isError: communityError, error: communityErr } = useQuery({
    queryKey: ['community', creatorId, communitySlug ?? 'default'],
    retry: false,
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
            commentCount?: number;
            likeCount?: number;
            likedByMe?: boolean;
            mediaUrls?: string[];
          }>;
        };
      }>(`/communities/${communityId}/posts`);
      return data.data.data;
    },
  });

  const { data: postComments } = useQuery({
    queryKey: ['community-post-comments', communityId, expandedPostId],
    enabled: !!communityId && !!expandedPostId,
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          data: Array<{
            id: string;
            body: string;
            parentId?: string | null;
            author?: { displayName?: string };
          }>;
        };
      }>(`/communities/${communityId}/posts/${expandedPostId}/comments`);
      return data.data.data;
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      await api.post(`/communities/${communityId}/posts/${postId}/reactions`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community-posts', communityId] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ postId, body }: { postId: string; body: string }) => {
      await api.post(`/communities/${communityId}/posts/${postId}/comments`, { body });
    },
    onSuccess: () => {
      setCommentDraft('');
      void qc.invalidateQueries({ queryKey: ['community-post-comments', communityId, expandedPostId] });
      void qc.invalidateQueries({ queryKey: ['community-posts', communityId] });
    },
  });

  type CommunityPollView = CommunityPoll;

  const { data: activePoll } = useQuery({
    queryKey: ['community-poll', communityId],
    enabled: !!communityId && view === 'polls',
    queryFn: async () => {
      const { data } = await api.get<{ data: CommunityPollView | null }>(
        `/communities/${communityId}/polls/active`,
      );
      return data.data ?? null;
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ pollId, optionIndex }: { pollId: string; optionIndex: number }) => {
      await api.post(`/communities/${communityId}/polls/${pollId}/vote`, { optionIndex });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community-poll', communityId] });
    },
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['community-leaderboard', communityId],
    enabled: !!communityId && view === 'leaderboard',
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ rank: number; userId: string; xp: number; level: number; streak?: number }>;
      }>(`/communities/${communityId}/leaderboard`);
      return data.data;
    },
  });

  const { data: gamificationProfile } = useQuery({
    queryKey: ['community-gamification-me', communityId],
    enabled: !!communityId && !!user && view === 'leaderboard',
    queryFn: async () => {
      const { data } = await api.get<{
        data: { xp: number; level: number; streak: number; badges: string[] };
      }>(`/communities/${communityId}/gamification/me`);
      return data.data;
    },
  });

  const { data: communityLive } = useQuery({
    queryKey: ['community-live', communityId],
    enabled: !!communityId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: string; title: string; viewerCount: number }>;
      }>(`/communities/${communityId}/live`);
      return data.data ?? [];
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

  const threadedMessages = useMemo(() => {
    const byId = new Map(messageList.map((m) => [m.id, m]));
    const roots = messageList.filter((m) => !m.parentId);
    const repliesByParent = new Map<string, ChannelMessage[]>();
    for (const m of messageList) {
      if (m.parentId) {
        const list = repliesByParent.get(m.parentId) ?? [];
        list.push(m);
        repliesByParent.set(m.parentId, list);
      }
    }
    const result: Array<{ message: ChannelMessage; depth: number }> = [];
    for (const root of roots) {
      result.push({ message: root, depth: 0 });
      for (const reply of repliesByParent.get(root.id) ?? []) {
        result.push({ message: reply, depth: 1 });
      }
    }
    for (const m of messageList) {
      if (m.parentId && !byId.has(m.parentId)) {
        result.push({ message: m, depth: 1 });
      }
    }
    return result;
  }, [messageList]);

  const accessDenied =
    !channelAccessible ||
    (messagesError &&
      typeof messagesError === 'object' &&
      'response' in messagesError &&
      (messagesError as { response?: { status?: number } }).response?.status === 403);

  const virtualizer = useVirtualizer({
    count: threadedMessages.length,
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
        { body, parentId: replyTo?.id },
      );
      return data.data;
    },
    onSuccess: (message) => {
      setText('');
      setReplyTo(null);
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
        targetType: 'message',
        channelId: activeChannelId,
        messageId,
        reason,
      });
    },
    onSuccess: () => setReportingId(null),
  });

  const reportPostMutation = useMutation({
    mutationFn: async ({ postId, reason }: { postId: string; reason: string }) => {
      if (!communityId) return;
      await api.post(`/communities/${communityId}/reports`, {
        targetType: 'post',
        postId,
        reason,
      });
    },
    onSuccess: () => setReportingPostId(null),
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
    if (threadedMessages.length > 0) {
      virtualizer.scrollToIndex(threadedMessages.length - 1, { align: 'end' });
    }
  }, [threadedMessages.length, virtualizer]);

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

  if (communityError && isAxiosError(communityErr) && communityErr.response?.status === 403) {
    return (
      <div className="glass-panel space-y-4 rounded-xl p-8 text-center">
        <Icon name="lock" className="mx-auto text-3xl text-outline" />
        <h3 className="font-semibold">This community is restricted</h3>
        <p className="text-sm text-on-surface-variant">
          You need membership or an invite to view this community.
        </p>
        {!isCreator ? <MembershipPanel creatorId={creatorId} /> : null}
      </div>
    );
  }

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
        <button
          type="button"
          onClick={() => setView('polls')}
          className={`rounded-full px-4 py-1.5 text-sm ${view === 'polls' ? 'bg-primary text-on-primary' : 'bg-surface-container-high'}`}
        >
          Polls
        </button>
        <button
          type="button"
          onClick={() => setView('leaderboard')}
          className={`rounded-full px-4 py-1.5 text-sm ${view === 'leaderboard' ? 'bg-primary text-on-primary' : 'bg-surface-container-high'}`}
        >
          Leaderboard
        </button>
      </div>
      {(communityLive ?? []).length > 0 ? (
        <div className="glass-panel space-y-2 rounded-xl border border-primary/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Live now</p>
          {(communityLive ?? []).map((stream) => (
            <a
              key={stream.id}
              href={`/live/${stream.id}`}
              className="block rounded-lg border border-outline-variant/30 px-3 py-2 text-sm hover:border-primary/40"
            >
              {stream.title}
              {stream.viewerCount > 0 ? ` · ${stream.viewerCount} watching` : ''}
            </a>
          ))}
        </div>
      ) : null}
      {view === 'leaderboard' ? (
        <div className="glass-panel space-y-2 rounded-xl p-4">
          {gamificationProfile && (
            <div className="mb-3 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm">
              <p>
                Your progress: Lv {gamificationProfile.level} · {gamificationProfile.xp} XP ·{' '}
                {gamificationProfile.streak} day streak
              </p>
              {gamificationProfile.badges.length > 0 && (
                <p className="mt-1 text-on-surface-variant">
                  Badges: {gamificationProfile.badges.join(', ')}
                </p>
              )}
            </div>
          )}
          {(leaderboard ?? []).length === 0 ? (
            <p className="text-sm text-on-surface-variant">No XP earned yet — chat and post to climb.</p>
          ) : (
            <ol className="space-y-2">
              {(leaderboard ?? []).map((row) => (
                <li
                  key={row.userId}
                  className="flex items-center justify-between rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                >
                  <span>
                    #{row.rank} · Lv {row.level}
                  </span>
                  <span className="font-medium">{row.xp} XP</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : view === 'polls' ? (
        <div className="glass-panel space-y-3 rounded-xl p-4">
          {!activePoll ? (
            <p className="text-sm text-on-surface-variant">No active poll right now.</p>
          ) : (
            <>
              <h3 className="font-semibold">{activePoll.question}</h3>
              <ul className="space-y-2">
                {activePoll.options.map((opt, i) => {
                  const count = activePoll.counts[i] ?? 0;
                  const pct =
                    activePoll.totalVotes > 0
                      ? Math.round((count / activePoll.totalVotes) * 100)
                      : 0;
                  const isMyVote = activePoll.myOptionIndex === i;
                  return (
                    <li key={opt}>
                      <button
                        type="button"
                        disabled={!user || voteMutation.isPending}
                        onClick={() =>
                          voteMutation.mutate({ pollId: activePoll.id, optionIndex: i })
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-surface-container-high disabled:opacity-50 ${
                          isMyVote
                            ? 'border-primary bg-primary/10'
                            : 'border-outline-variant/40'
                        }`}
                      >
                        <span>{opt}</span>
                        {isMyVote ? (
                          <span className="ml-2 text-xs font-medium text-primary">Your vote</span>
                        ) : null}
                        <span className="ml-2 text-xs text-outline">
                          {count} ({pct}%)
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-outline">{activePoll.totalVotes} votes</p>
              {!user ? (
                <p className="text-xs text-on-surface-variant">Sign in to vote.</p>
              ) : null}
            </>
          )}
        </div>
      ) : view === 'posts' ? (
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
                <CommunityPostMedia urls={p.mediaUrls ?? []} />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className={`text-xs ${p.likedByMe ? 'text-primary font-medium' : 'text-outline'}`}
                    disabled={!user || likeMutation.isPending}
                    onClick={() => likeMutation.mutate(p.id)}
                  >
                    ♥ {p.likeCount ?? 0}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-outline"
                    onClick={() =>
                      setExpandedPostId((cur) => (cur === p.id ? null : p.id))
                    }
                  >
                    💬 {p.commentCount ?? 0} comments
                  </button>
                </div>
                {expandedPostId === p.id ? (
                  <div className="mt-3 space-y-2 rounded-lg bg-surface-container-low p-3">
                    {(postComments ?? []).map((c) => (
                      <p key={c.id} className="text-sm">
                        <span className="font-medium">{c.author?.displayName ?? 'Member'}</span>
                        {c.parentId ? (
                          <span className="text-xs text-outline"> · reply</span>
                        ) : null}
                        <span className="text-on-surface-variant"> — {c.body}</span>
                      </p>
                    ))}
                    {user ? (
                      <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const body = commentDraft.trim();
                          if (!body) return;
                          commentMutation.mutate({ postId: p.id, body });
                        }}
                      >
                        <Input
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                          placeholder="Add a comment…"
                          className="flex-1 text-sm"
                        />
                        <Button type="submit" disabled={commentMutation.isPending}>
                          Post
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-outline">
                    {p.author?.displayName ?? 'Creator'} · {p.postType}
                  </p>
                  {user && !isCreator ? (
                    reportingPostId === p.id ? (
                      <form
                        className="flex gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          const reason = String(fd.get('reason') ?? '').trim();
                          if (!reason) return;
                          reportPostMutation.mutate({ postId: p.id, reason });
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
                        onClick={() => setReportingPostId(p.id)}
                      >
                        Report
                      </Button>
                    )
                  ) : null}
                </div>
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
          <AccessSessionConflict message={conflict} onTakeOver={takeOver} />
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
                  const entry = threadedMessages[item.index];
                  const m = entry.message;
                  const canDelete = user && (m.userId === user.id || isCreator);
                  const canReport = user && m.userId !== user.id && !m.deletedAt;
                  const parent = m.parentId
                    ? messageList.find((msg) => msg.id === m.parentId)
                    : null;
                  return (
                    <div
                      key={m.id}
                      className="absolute left-0 top-0 w-full text-sm"
                      style={{
                        transform: `translateY(${item.start}px)`,
                        paddingLeft: entry.depth > 0 ? `${entry.depth * 16}px` : undefined,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 py-1">
                        <div>
                          {entry.depth > 0 && parent ? (
                            <p className="text-[10px] text-outline">
                              ↳ reply to {parent.user?.displayName ?? 'message'}
                            </p>
                          ) : null}
                          <span className="font-medium">{m.user?.displayName ?? 'Member'}</span>
                          <span className="text-on-surface-variant"> · </span>
                          <span className={m.deletedAt ? 'italic text-outline' : ''}>{m.body}</span>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {user && !m.deletedAt ? (
                            <Button
                              variant="ghost"
                              className="px-2 py-0 text-xs"
                              onClick={() => setReplyTo(m)}
                            >
                              Reply
                            </Button>
                          ) : null}
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
                className="flex flex-col gap-2 border-t border-outline-variant/30 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const body = text.trim();
                  if (!body) return;
                  sendMutation.mutate(body);
                }}
              >
                {replyTo ? (
                  <p className="text-xs text-on-surface-variant">
                    Replying to {replyTo.user?.displayName ?? 'message'}
                    <button
                      type="button"
                      className="ml-2 text-primary"
                      onClick={() => setReplyTo(null)}
                    >
                      Cancel
                    </button>
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={replyTo ? 'Write a reply…' : 'Message channel…'}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={sendMutation.isPending}>
                    Send
                  </Button>
                </div>
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
