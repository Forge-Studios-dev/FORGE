'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, EmptyState, Icon, Input } from '@forge/design-system';
import { SocketEvents } from '@forge/shared-types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import { MembershipPanel } from '@/components/Membership/MembershipPanel';
import { CommunityEngagePanel } from '@/components/Community/CommunityEngagePanel';
import { CommunityPostMedia } from '@/components/Community/CommunityPostMedia';
import { CommunityWelcomeModal } from '@/components/Community/CommunityWelcomeModal';
import type { CommunityPayload, CommunityPoll } from '@/types/community';
import { isAxiosError } from 'axios';

type MembershipMeResponse = {
  data: {
    active?: boolean;
    subscription?: { tier?: { name?: string } };
  };
};

interface Props {
  creatorId: string;
  communitySlug?: string;
}

function CommunityRestrictedAccess({
  creatorId,
  communitySlug,
  isCreator,
}: {
  creatorId: string;
  communitySlug?: string;
  isCreator: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const accessPath = communitySlug
    ? `/creators/${creatorId}/communities/${communitySlug}/access`
    : null;

  const { data: accessMeta } = useQuery({
    queryKey: ['community-access-meta', creatorId, communitySlug],
    enabled: !!accessPath && !!user,
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          communityId: string;
          canRequestJoin: boolean;
          joinRequestStatus: string;
          visibility: string;
        };
      }>(accessPath!);
      return data.data;
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (targetCommunityId: string) => {
      await api.post(`/communities/${targetCommunityId}/join-request`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community-access-meta', creatorId, communitySlug] });
    },
  });

  return (
    <div className="glass-panel space-y-4 rounded-xl p-8 text-center">
      <Icon name="lock" className="mx-auto text-3xl text-outline" />
      <h3 className="font-semibold">This community is restricted</h3>
      <p className="text-sm text-on-surface-variant">
        You need membership, an invite, or creator approval to view this community.
      </p>
      {!isCreator && accessMeta?.joinRequestStatus === 'pending' ? (
        <p className="text-sm text-primary">Your join request is pending approval.</p>
      ) : null}
      {!isCreator && accessMeta?.canRequestJoin ? (
        <Button
          disabled={joinMutation.isPending}
          onClick={() => joinMutation.mutate(accessMeta.communityId)}
        >
          Request to join
        </Button>
      ) : null}
      {!isCreator && accessMeta?.visibility === 'paid' ? (
        <MembershipPanel creatorId={creatorId} communityId={accessMeta?.communityId} />
      ) : null}
      {!user ? (
        <p className="text-xs text-on-surface-variant">Sign in to request access or subscribe.</p>
      ) : null}
    </div>
  );
}

export function CommunityPanel({ creatorId, communitySlug }: Props) {
  const { user, accessToken } = useAuth();
  const qc = useQueryClient();
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportingPoll, setReportingPoll] = useState(false);
  const [view, setView] = useState<'posts' | 'polls' | 'engage'>('engage');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const isCreator = user?.id === creatorId;

  const { data: myMembership } = useQuery({
    queryKey: ['membership-me', creatorId],
    enabled: !!user && !isCreator,
    queryFn: async () => {
      const { data } = await api.get<MembershipMeResponse>(`/creators/${creatorId}/membership/me`);
      return data.data;
    },
  });

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
  const showWelcome =
    !!myMembership?.active &&
    !!communityData?.community?.name &&
    !isCreator;

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
    mutationFn: async ({
      postId,
      body,
      parentId,
    }: {
      postId: string;
      body: string;
      parentId?: string;
    }) => {
      await api.post(`/communities/${communityId}/posts/${postId}/comments`, { body, parentId });
    },
    onSuccess: () => {
      setCommentDraft('');
      setReplyToCommentId(null);
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

  const { data: communityLive } = useQuery({
    queryKey: ['community-live', communityId],
    enabled: !!communityId,
    refetchInterval: () => {
      const socket = accessToken ? getSocket(accessToken) : null;
      if (socket?.connected) return false;
      return 90_000;
    },
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: string; title: string; viewerCount: number }>;
      }>(`/communities/${communityId}/live`);
      return data.data ?? [];
    },
  });

  useEffect(() => {
    if (!accessToken || !communityId) return;
    const socket = getSocket(accessToken);
    if (!socket) return;
    socket.emit('join-community', { communityId });
    const invalidate = (payload?: { communityId?: string | null }) => {
      if (payload?.communityId && payload.communityId !== communityId) return;
      void qc.invalidateQueries({ queryKey: ['community-live', communityId] });
    };
    socket.on(SocketEvents.STREAM_STARTED, invalidate);
    socket.on(SocketEvents.STREAM_ENDED, invalidate);
    return () => {
      socket.off(SocketEvents.STREAM_STARTED, invalidate);
      socket.off(SocketEvents.STREAM_ENDED, invalidate);
      socket.emit('leave-community', { communityId });
    };
  }, [accessToken, communityId, qc]);

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

  const reportPollMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!communityId || !activePoll) return;
      await api.post(`/communities/${communityId}/reports`, {
        targetType: 'poll',
        pollId: activePoll.id,
        reason,
      });
    },
    onSuccess: () => setReportingPoll(false),
  });

  if (communityError && isAxiosError(communityErr) && communityErr.response?.status === 403) {
    return (
      <CommunityRestrictedAccess
        creatorId={creatorId}
        communitySlug={communitySlug}
        isCreator={isCreator}
      />
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
      {showWelcome && communityData?.community?.name ? (
        <CommunityWelcomeModal
          communityName={communityData.community.name}
          onDismiss={() => undefined}
        />
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setView('engage')}
          className={`rounded-full px-4 py-1.5 text-sm ${view === 'engage' ? 'bg-primary text-on-primary' : 'bg-surface-container-high'}`}
        >
          Rooms
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
      {view === 'polls' ? (
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
              {user ? (
                reportingPoll ? (
                  <div className="mt-2 flex gap-2">
                    <Input
                      placeholder="Reason"
                      defaultValue="Inappropriate poll"
                      id="poll-report-reason"
                    />
                    <Button
                      variant="secondary"
                      className="text-xs"
                      onClick={() => {
                        const el = document.getElementById('poll-report-reason') as HTMLInputElement;
                        reportPollMutation.mutate(el?.value?.trim() || 'Reported');
                      }}
                    >
                      Submit
                    </Button>
                    <Button variant="ghost" className="text-xs" onClick={() => setReportingPoll(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mt-2 text-xs text-outline hover:text-error"
                    onClick={() => setReportingPoll(true)}
                  >
                    Report poll
                  </button>
                )
              ) : null}
              {!user ? (
                <p className="text-xs text-on-surface-variant">Sign in to vote.</p>
              ) : null}
            </>
          )}
        </div>
      ) : view === 'engage' && communityId ? (
        <div className="glass-panel rounded-xl p-4">
          <CommunityEngagePanel communityId={communityId} />
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
                    aria-label={p.likedByMe ? `Unlike post, ${p.likeCount ?? 0} likes` : `Like post, ${p.likeCount ?? 0} likes`}
                    aria-pressed={!!p.likedByMe}
                    className={`text-xs ${p.likedByMe ? 'text-primary font-medium' : 'text-outline'}`}
                    disabled={!user || likeMutation.isPending}
                    onClick={() => likeMutation.mutate(p.id)}
                  >
                    <Icon name="thumb_up" filled={!!p.likedByMe} className="text-sm" />{' '}
                    {p.likeCount ?? 0}
                  </button>
                  <button
                    type="button"
                    aria-label={`Toggle comments, ${p.commentCount ?? 0} comments`}
                    aria-expanded={expandedPostId === p.id}
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
                    {(postComments ?? []).map((c) => {
                      const isReply = !!c.parentId;
                      return (
                        <div
                          key={c.id}
                          className="text-sm"
                          style={{ paddingLeft: isReply ? '16px' : undefined }}
                        >
                          <span className="font-medium">{c.author?.displayName ?? 'Member'}</span>
                          {isReply ? (
                            <span className="text-xs text-outline"> · reply</span>
                          ) : null}
                          <span className="text-on-surface-variant"> — {c.body}</span>
                          {user ? (
                            <button
                              type="button"
                              className="ml-2 text-xs text-primary"
                              onClick={() => setReplyToCommentId(c.id)}
                            >
                              Reply
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                    {user ? (
                      <form
                        className="flex flex-col gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const body = commentDraft.trim();
                          if (!body) return;
                          commentMutation.mutate({
                            postId: p.id,
                            body,
                            parentId: replyToCommentId ?? undefined,
                          });
                        }}
                      >
                        {replyToCommentId ? (
                          <p className="text-xs text-on-surface-variant">
                            Replying to comment
                            <button
                              type="button"
                              className="ml-2 text-primary"
                              onClick={() => setReplyToCommentId(null)}
                            >
                              Cancel
                            </button>
                          </p>
                        ) : null}
                        <div className="flex gap-2">
                          <Input
                            value={commentDraft}
                            onChange={(e) => setCommentDraft(e.target.value)}
                            placeholder={replyToCommentId ? 'Write a reply…' : 'Add a comment…'}
                            className="flex-1 text-sm"
                          />
                          <Button type="submit" disabled={commentMutation.isPending}>
                            Post
                          </Button>
                        </div>
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
      ) : null}
    </div>
  );
}
