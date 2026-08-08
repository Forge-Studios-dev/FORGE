'use client';

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getAccessToken } from '@/lib/auth-storage';
import { Comment, User } from '@/types';
import { getSocket, joinRoom, leaveRoom } from '@/lib/socket';
import { formatCount, timeAgo } from '@/lib/utils';
import { COMMENT_REPORT_REASONS } from '@/lib/report-reasons';
import { splitCommentMentions } from '@/lib/comment-text';
import { parseTimestampToSeconds } from '@/lib/description-timestamps';
import { Icon } from '@forge/design-system';
import { ConfirmDialog } from '@forge/design-system/client';

type CommentsResponse = {
  data: Comment[];
  meta: { cursor: string | null; hasMore: boolean; total?: number; sort?: string };
};

type CommentSort = 'top' | 'newest' | 'oldest';

function CommentBody({
  content,
  onSeek,
}: {
  content: string;
  onSeek?: (seconds: number) => void;
}) {
  const parts = splitCommentMentions(content);
  return (
    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
      {parts.map((part, i) => {
        if (part.type === 'mention') {
          return (
            <Link
              key={`${i}-${part.username}`}
              href={`/${part.username}`}
              className="font-medium text-primary hover:underline"
            >
              {part.value}
            </Link>
          );
        }
        if (!onSeek) return <span key={i}>{part.value}</span>;
        // Light timestamp linkify inside plain text (mm:ss / h:mm:ss)
        const stampRe =
          /(?:^|[\s([{])((?:\d{1,2}:)?[0-5]?\d:[0-5]\d)(?=$|[\s)\].,!?;:])/g;
        const nodes: ReactNode[] = [];
        let last = 0;
        let m: RegExpExecArray | null;
        const text = part.value;
        while ((m = stampRe.exec(text)) !== null) {
          const stamp = m[1];
          const stampIndex = m.index + m[0].indexOf(stamp);
          const seconds = parseTimestampToSeconds(stamp);
          if (seconds === null) continue;
          if (stampIndex > last) nodes.push(text.slice(last, stampIndex));
          nodes.push(
            <button
              key={`${i}-t-${stampIndex}`}
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => onSeek(seconds)}
            >
              {stamp}
            </button>,
          );
          last = stampIndex + stamp.length;
        }
        if (last < text.length) nodes.push(text.slice(last));
        return <span key={i}>{nodes.length ? nodes : text}</span>;
      })}
    </p>
  );
}

function CommentRow({
  comment,
  videoId,
  onReply,
  currentUser,
  onGuestInteract,
  onRefresh,
  isVideoOwner = false,
  depth = 0,
  onSeek,
  highlightId = null,
  autoExpandReplies = false,
}: {
  comment: Comment;
  videoId: string;
  onReply: (parentId: string, mentionUsername?: string) => void;
  currentUser?: User | null;
  onGuestInteract?: () => void;
  onRefresh: () => void;
  isVideoOwner?: boolean;
  depth?: number;
  onSeek?: (seconds: number) => void;
  highlightId?: string | null;
  autoExpandReplies?: boolean;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [confirmAction, setConfirmAction] = useState<'delete' | 'remove' | null>(null);

  useEffect(() => {
    if (!reportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReportOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reportOpen]);
  const [liked, setLiked] = useState(!!comment.viewerLiked);
  const [disliked, setDisliked] = useState(!!comment.viewerDisliked);
  const [likeCount, setLikeCount] = useState(comment.likeCount ?? 0);
  const [pinned, setPinned] = useState(!!comment.isPinned);
  const [hearted, setHearted] = useState(!!comment.creatorHearted);
  const [replyCursor, setReplyCursor] = useState<string | null>(null);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [repliesHasMore, setRepliesHasMore] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [linkHint, setLinkHint] = useState<string | null>(null);
  const autoExpandedRef = useRef(false);

  const isOwn = currentUser?.id === comment.userId;
  const isHighlighted = highlightId === comment.id;

  const loadReplies = useCallback(
    async (cursor?: string) => {
      setLoadingReplies(true);
      try {
        const qs = new URLSearchParams({ limit: '20' });
        if (cursor) qs.set('cursor', cursor);
        const { data } = await api.get<{ data: CommentsResponse }>(
          `/videos/${videoId}/comments/${comment.id}/replies?${qs}`,
        );
        const page = data.data;
        setReplies((prev) => (cursor ? [...prev, ...page.data] : page.data));
        setReplyCursor(page.meta.cursor);
        setRepliesHasMore(page.meta.hasMore);
      } finally {
        setLoadingReplies(false);
      }
    },
    [comment.id, videoId],
  );

  useEffect(() => {
    if (!autoExpandReplies || depth !== 0 || autoExpandedRef.current) return;
    autoExpandedRef.current = true;
    setShowReplies(true);
    void loadReplies();
  }, [autoExpandReplies, depth, loadReplies]);

  useEffect(() => {
    if (!isHighlighted) return;
    const el = document.getElementById(`comment-${comment.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isHighlighted, comment.id, showReplies, replies.length]);

  const copyCommentLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lc', comment.id);
      await navigator.clipboard.writeText(url.toString());
      setLinkHint('Link copied');
      window.setTimeout(() => setLinkHint(null), 2000);
    } catch {
      setLinkHint('Could not copy');
      window.setTimeout(() => setLinkHint(null), 2000);
    }
  };

  const toggleReplies = () => {
    const next = !showReplies;
    setShowReplies(next);
    if (next && replies.length === 0) void loadReplies();
  };

  const likeMut = useMutation({
    mutationFn: async () => {
      if (liked) {
        await api.delete(`/videos/${videoId}/comments/${comment.id}/like`);
      } else {
        await api.post(`/videos/${videoId}/comments/${comment.id}/like`);
      }
    },
    onMutate: () => {
      const wasLiked = liked;
      const wasDisliked = disliked;
      setLiked(!wasLiked);
      if (!wasLiked && wasDisliked) setDisliked(false);
      setLikeCount((c) => (wasLiked ? Math.max(0, c - 1) : c + 1));
    },
    onError: () => {
      setLiked(!!comment.viewerLiked);
      setDisliked(!!comment.viewerDisliked);
      setLikeCount(comment.likeCount ?? 0);
    },
  });

  const dislikeMut = useMutation({
    mutationFn: async () => {
      if (disliked) {
        await api.delete(`/videos/${videoId}/comments/${comment.id}/dislike`);
      } else {
        await api.post(`/videos/${videoId}/comments/${comment.id}/dislike`);
      }
    },
    onMutate: () => {
      const wasLiked = liked;
      const wasDisliked = disliked;
      setDisliked(!wasDisliked);
      if (!wasDisliked && wasLiked) {
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      }
    },
    onError: () => {
      setLiked(!!comment.viewerLiked);
      setDisliked(!!comment.viewerDisliked);
      setLikeCount(comment.likeCount ?? 0);
    },
  });

  const editMut = useMutation({
    mutationFn: async () => {
      await api.patch(`/videos/${videoId}/comments/${comment.id}`, { content: editText.trim() });
    },
    onSuccess: () => {
      setEditing(false);
      onRefresh();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      await api.delete(`/videos/${videoId}/comments/${comment.id}`);
    },
    onSuccess: () => {
      setConfirmAction(null);
      onRefresh();
    },
  });

  const reportMut = useMutation({
    mutationFn: async () => {
      const reason =
        reportReason === 'Other'
          ? reportDetails.trim() || 'Other'
          : reportDetails.trim()
            ? `${reportReason}: ${reportDetails.trim()}`
            : reportReason;
      await api.post('/reports', {
        targetType: 'comment',
        targetId: comment.id,
        reason: reason.slice(0, 2000),
      });
    },
    onSuccess: () => {
      setReportOpen(false);
      setReportReason('');
      setReportDetails('');
    },
  });

  const pinMut = useMutation({
    mutationFn: async (next: boolean) => {
      await api.post(`/videos/${videoId}/comments/${comment.id}/pin`, { isPinned: next });
    },
    onMutate: (next) => setPinned(next),
    onError: (_e, next) => setPinned(!next),
    onSuccess: onRefresh,
  });

  const heartMut = useMutation({
    mutationFn: async (next: boolean) => {
      await api.post(`/videos/${videoId}/comments/${comment.id}/creator-heart`, {
        creatorHearted: next,
      });
    },
    onMutate: (next) => setHearted(next),
    onError: (_e, next) => setHearted(!next),
    onSuccess: onRefresh,
  });

  return (
    <article
      id={`comment-${comment.id}`}
      className={`flex gap-4 rounded-xl transition ${
        isHighlighted ? 'bg-primary/10 ring-1 ring-primary/40' : ''
      }`}
    >
      {comment.user?.avatarUrl ? (
        <Image src={comment.user.avatarUrl} alt="" width={40} height={40} className="rounded-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-sm font-bold text-primary">
          {(comment.user?.displayName ?? '?')[0]}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          {pinned ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Pinned
            </span>
          ) : null}
          {comment.user?.username ? (
            <Link
              href={`/${comment.user.username}`}
              className="text-sm font-medium text-on-surface hover:text-primary"
            >
              {comment.user.displayName ?? comment.user.username}
            </Link>
          ) : (
            <span className="text-sm font-medium text-on-surface">
              {comment.user?.displayName ?? 'User'}
            </span>
          )}
          <span className="font-label-caps text-[10px] text-outline">{timeAgo(comment.createdAt)}</span>
          {hearted ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-error" title="Hearted by creator">
              ❤ Creator
            </span>
          ) : null}
        </div>
        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => editMut.mutate()}
                disabled={editMut.isPending || !editText.trim()}
                className="text-xs font-semibold text-primary"
              >
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-outline">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <CommentBody content={comment.content} onSeek={onSeek} />
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <button
            type="button"
            aria-label={liked ? `Unlike comment, ${likeCount} likes` : `Like comment, ${likeCount} likes`}
            aria-pressed={liked}
            disabled={likeMut.isPending || dislikeMut.isPending}
            onClick={() => {
              if (!currentUser) {
                onGuestInteract?.();
                return;
              }
              likeMut.mutate();
            }}
            className={`inline-flex items-center gap-1 font-semibold ${liked ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            <Icon name="thumb_up" filled={liked} className="text-sm" />
            {likeCount > 0 ? formatCount(likeCount) : 'Like'}
          </button>
          <button
            type="button"
            aria-label={disliked ? 'Remove dislike' : 'Dislike comment'}
            aria-pressed={disliked}
            disabled={likeMut.isPending || dislikeMut.isPending}
            onClick={() => {
              if (!currentUser) {
                onGuestInteract?.();
                return;
              }
              dislikeMut.mutate();
            }}
            className={`inline-flex items-center font-semibold ${disliked ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            <Icon name="thumb_down" filled={disliked} className="text-sm" />
          </button>
          {depth === 0 && (comment.replyCount ?? 0) > 0 ? (
            <button
              type="button"
              onClick={toggleReplies}
              className="font-semibold text-primary hover:underline"
              aria-expanded={showReplies}
            >
              {showReplies
                ? 'Hide replies'
                : `${formatCount(comment.replyCount!)} ${comment.replyCount === 1 ? 'reply' : 'replies'}`}
            </button>
          ) : null}
          {depth === 0 && (
            <button
              type="button"
              onClick={() => {
                if (!showReplies && (comment.replyCount ?? 0) > 0) {
                  setShowReplies(true);
                  if (replies.length === 0) void loadReplies();
                }
                onReply(comment.id, comment.user?.username);
              }}
              className="font-semibold text-on-surface-variant hover:text-primary"
            >
              Reply
            </button>
          )}
          {isOwn && !editing && (
            <>
              <button type="button" onClick={() => setEditing(true)} className="text-on-surface-variant hover:text-primary">
                Edit
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction('delete')}
                className="text-error hover:underline"
              >
                Delete
              </button>
            </>
          )}
          {isVideoOwner && !isOwn && (
            <button
              type="button"
              onClick={() => setConfirmAction('remove')}
              className="text-error hover:underline"
              aria-label="Remove comment"
            >
              Remove
            </button>
          )}
          {isVideoOwner && depth === 0 && (
            <button
              type="button"
              disabled={pinMut.isPending}
              onClick={() => pinMut.mutate(!pinned)}
              className="text-on-surface-variant hover:text-primary"
              aria-label={pinned ? 'Unpin comment' : 'Pin comment'}
              aria-pressed={pinned}
            >
              {pinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          {isVideoOwner && (
            <button
              type="button"
              disabled={heartMut.isPending}
              onClick={() => heartMut.mutate(!hearted)}
              className={`inline-flex items-center gap-0.5 ${hearted ? 'text-error' : 'text-on-surface-variant hover:text-error'}`}
              aria-pressed={hearted}
              aria-label={hearted ? 'Remove heart' : 'Heart comment'}
              title={hearted ? 'Remove heart' : 'Heart'}
            >
              <Icon name="favorite" filled={hearted} className="text-sm" />
            </button>
          )}
          {!isOwn && currentUser && (
            <button type="button" onClick={() => setReportOpen(true)} className="text-on-surface-variant hover:text-primary">
              Report
            </button>
          )}
          <button
            type="button"
            onClick={() => void copyCommentLink()}
            className="text-on-surface-variant hover:text-primary"
          >
            {linkHint ?? 'Copy link'}
          </button>
        </div>
        {showReplies && (
          <div className="mt-4 space-y-4 border-l border-outline-variant/30 pl-4">
            {replies.map((r) => (
              <CommentRow
                key={r.id}
                comment={r}
                videoId={videoId}
                onReply={onReply}
                currentUser={currentUser}
                onGuestInteract={onGuestInteract}
                onRefresh={onRefresh}
                isVideoOwner={isVideoOwner}
                depth={1}
                onSeek={onSeek}
                highlightId={highlightId}
              />
            ))}
            {repliesHasMore && (
              <button
                type="button"
                onClick={() => void loadReplies(replyCursor ?? undefined)}
                disabled={loadingReplies}
                className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              >
                {loadingReplies ? 'Loading…' : 'Load more replies'}
              </button>
            )}
          </div>
        )}
      </div>
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`comment-report-title-${comment.id}`}
          onClick={() => setReportOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={`comment-report-title-${comment.id}`} className="font-semibold">
              Report comment
            </h3>
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">Reason</legend>
              {COMMENT_REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                    reportReason === r
                      ? 'border-primary bg-primary/10'
                      : 'border-outline-variant/40 text-on-surface-variant'
                  }`}
                >
                  <input
                    type="radio"
                    name={`comment-report-${comment.id}`}
                    value={r}
                    checked={reportReason === r}
                    onChange={() => setReportReason(r)}
                  />
                  {r}
                </label>
              ))}
            </fieldset>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder={
                reportReason === 'Other' ? 'Describe the issue (required)…' : 'Optional details…'
              }
              rows={3}
              className="mt-3 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setReportOpen(false)} className="px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !reportReason ||
                  (reportReason === 'Other' && reportDetails.trim().length < 3) ||
                  reportMut.isPending
                }
                onClick={() => reportMut.mutate()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmAction === 'delete'}
        title="Delete comment?"
        description="This permanently removes your comment."
        confirmLabel="Delete"
        onConfirm={() => deleteMut.mutate()}
        onCancel={() => setConfirmAction(null)}
        loading={deleteMut.isPending}
      />
      <ConfirmDialog
        open={confirmAction === 'remove'}
        title="Remove comment?"
        description="This removes the comment from your video."
        confirmLabel="Remove"
        onConfirm={() => deleteMut.mutate()}
        onCancel={() => setConfirmAction(null)}
        loading={deleteMut.isPending}
      />
    </article>
  );
}

export function CommentsPanel({
  videoId,
  videoOwnerId,
  commentCount = 0,
  onGuestInteract,
  onSeek,
}: {
  videoId: string;
  videoOwnerId?: string;
  commentCount?: number;
  onGuestInteract?: () => void;
  onSeek?: (seconds: number) => void;
}) {
  const [content, setContent] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<CommentSort>('top');
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('lc');
  const queryClient = useQueryClient();
  const isVideoOwner = !!user?.id && !!videoOwnerId && user.id === videoOwnerId;

  const linkedCommentQuery = useQuery({
    queryKey: ['comment', videoId, highlightId],
    enabled: !!highlightId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: Comment }>(
        `/videos/${videoId}/comments/${highlightId}`,
      );
      return data.data;
    },
  });
  const autoExpandParentId = linkedCommentQuery.data?.parentId ?? null;

  const startReply = (parentId: string, mentionUsername?: string) => {
    setReplyToId(parentId);
    if (mentionUsername) {
      setContent((prev) => {
        const mention = `@${mentionUsername} `;
        if (prev.includes(mention) || prev.trim().startsWith(`@${mentionUsername}`)) return prev;
        return prev.trim() ? `${prev.trimEnd()} ${mention}` : mention;
      });
    }
  };

  const refreshComments = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['comments', videoId] });
  }, [queryClient, videoId]);

  const { data, isLoading } = useQuery({
    queryKey: ['comments', videoId, sort],
    queryFn: async () => {
      const { data } = await api.get<{ data: CommentsResponse }>(
        `/videos/${videoId}/comments?limit=20&sort=${sort}`,
      );
      return data.data;
    },
  });

  const loadMore = useCallback(async () => {
    if (!data?.meta.hasMore || !data.meta.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data: next } = await api.get<{ data: CommentsResponse }>(
        `/videos/${videoId}/comments?limit=20&sort=${sort}&cursor=${encodeURIComponent(data.meta.cursor)}`,
      );
      queryClient.setQueryData(['comments', videoId, sort], {
        data: [...(data.data ?? []), ...next.data.data],
        meta: next.data.meta,
      });
    } finally {
      setLoadingMore(false);
    }
  }, [data, videoId, queryClient, loadingMore, sort]);

  const post = useMutation({
    mutationFn: async () => {
      if (!content.trim()) return null;
      const body: { content: string; parentId?: string } = { content: content.trim() };
      if (replyToId) body.parentId = replyToId;
      const { data } = await api.post(`/videos/${videoId}/comments`, body);
      return data.data as Comment;
    },
    onSuccess: () => {
      setContent('');
      setReplyToId(null);
      refreshComments();
    },
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!user?.id || !token) return;
    const socket = getSocket(token);
    if (!socket) return;

    joinRoom('join-video', { videoId });

    const onNewComment = refreshComments;
    socket.on('comment:new', onNewComment);

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(onNewComment, 30_000);
    };
    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const onConnect = () => {
      stopPolling();
      joinRoom('join-video', { videoId });
    };
    const onDisconnect = () => startPolling();

    if (!socket.connected) startPolling();
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      stopPolling();
      leaveRoom('leave-video', { videoId });
      socket.off('comment:new', onNewComment);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [user?.id, videoId, refreshComments]);

  const count = data?.meta?.total ?? commentCount;

  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display-forge text-xl font-semibold md:text-2xl">
          Comments{' '}
          <span className="text-lg font-normal text-on-surface-variant">{formatCount(count)}</span>
        </h3>
        <div
          className="flex gap-1 rounded-full bg-surface-container-high p-1"
          role="tablist"
          aria-label="Sort comments"
          aria-orientation="horizontal"
        >
          {(
            [
              { id: 'top' as const, label: 'Top' },
              { id: 'newest' as const, label: 'Newest' },
              { id: 'oldest' as const, label: 'Oldest' },
            ] as const
          ).map((opt, i, arr) => {
            const selected = sort === opt.id;
            const focusSort = (index: number) => {
              const next = arr[(index + arr.length) % arr.length];
              const btn = document.getElementById(`comment-sort-${next.id}`);
              btn?.focus();
              setSort(next.id);
            };
            return (
              <button
                key={opt.id}
                id={`comment-sort-${opt.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setSort(opt.id)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    focusSort(i + 1);
                  }
                  if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    focusSort(i - 1);
                  }
                  if (e.key === 'Home') {
                    e.preventDefault();
                    focusSort(0);
                  }
                  if (e.key === 'End') {
                    e.preventDefault();
                    focusSort(arr.length - 1);
                  }
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-4">
        {user?.avatarUrl ? (
          <Image src={user.avatarUrl} alt="" width={40} height={40} className="rounded-full border border-outline-variant/30 object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-high text-sm font-bold text-primary">
            {user?.displayName?.[0] ?? '?'}
          </div>
        )}
        <div className="flex-1 space-y-2">
          {replyToId && (
            <p className="text-xs text-on-surface-variant">
              Replying to comment{' '}
              <button type="button" className="text-primary hover:underline" onClick={() => setReplyToId(null)}>
                cancel
              </button>
            </p>
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => {
              if (!user && onGuestInteract) onGuestInteract();
            }}
            placeholder={user ? 'Add to the discussion…' : 'Sign in to comment'}
            rows={2}
            readOnly={!user}
            disabled={post.isPending}
            className={`w-full resize-none border-0 border-b border-outline-variant bg-transparent px-0 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-0 disabled:opacity-60 ${!user ? 'opacity-60' : ''}`}
          />
          <div className="flex justify-end gap-2">
            {content && (
              <button
                type="button"
                onClick={() => setContent('')}
                className="font-label-caps rounded-full px-4 py-2 text-on-surface-variant transition hover:bg-surface-container-high"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!user && onGuestInteract) {
                  onGuestInteract();
                  return;
                }
                post.mutate();
              }}
              disabled={!user || post.isPending || !content.trim()}
              className="primary-button rounded-full px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-on-surface-variant">Loading discussion…</p>
        ) : data?.data?.length ? (
          <>
            {linkedCommentQuery.data &&
            ((!linkedCommentQuery.data.parentId &&
              !data.data.some((c) => c.id === linkedCommentQuery.data!.id)) ||
              (linkedCommentQuery.data.parentId &&
                !data.data.some((c) => c.id === linkedCommentQuery.data!.parentId))) ? (
              <CommentRow
                key={`linked-${linkedCommentQuery.data.id}`}
                comment={linkedCommentQuery.data}
                videoId={videoId}
                onReply={startReply}
                currentUser={user}
                onGuestInteract={onGuestInteract}
                onRefresh={refreshComments}
                isVideoOwner={isVideoOwner}
                onSeek={onSeek}
                highlightId={highlightId}
                depth={linkedCommentQuery.data.parentId ? 1 : 0}
              />
            ) : null}
            {data.data.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                videoId={videoId}
                onReply={startReply}
                currentUser={user}
                onGuestInteract={onGuestInteract}
                onRefresh={refreshComments}
                isVideoOwner={isVideoOwner}
                onSeek={onSeek}
                highlightId={highlightId}
                autoExpandReplies={autoExpandParentId === c.id}
              />
            ))}
            {data.meta.hasMore && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="text-sm font-semibold text-primary hover:underline disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more comments'}
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">No comments yet. Start the discussion.</p>
        )}
      </div>
    </section>
  );
}
