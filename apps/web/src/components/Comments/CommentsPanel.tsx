'use client';

import { useEffect, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getAccessToken } from '@/lib/auth-storage';
import { Comment, User } from '@/types';
import { getSocket, joinRoom, leaveRoom } from '@/lib/socket';
import { formatCount, timeAgo } from '@/lib/utils';

type CommentsResponse = {
  data: Comment[];
  meta: { cursor: string | null; hasMore: boolean; total?: number };
};

function CommentRow({
  comment,
  videoId,
  onReply,
  currentUser,
  onGuestInteract,
  onRefresh,
  depth = 0,
}: {
  comment: Comment;
  videoId: string;
  onReply: (parentId: string) => void;
  currentUser?: User | null;
  onGuestInteract?: () => void;
  onRefresh: () => void;
  depth?: number;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [liked, setLiked] = useState(!!comment.viewerLiked);
  const [likeCount, setLikeCount] = useState(comment.likeCount ?? 0);
  const [replyCursor, setReplyCursor] = useState<string | null>(null);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [repliesHasMore, setRepliesHasMore] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const isOwn = currentUser?.id === comment.userId;

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
      setLiked((v) => !v);
      setLikeCount((c) => (liked ? Math.max(0, c - 1) : c + 1));
    },
    onError: () => {
      setLiked(!!comment.viewerLiked);
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
    onSuccess: onRefresh,
  });

  const reportMut = useMutation({
    mutationFn: async () => {
      await api.post('/reports', {
        targetType: 'comment',
        targetId: comment.id,
        reason: reportReason.trim(),
      });
    },
    onSuccess: () => {
      setReportOpen(false);
      setReportReason('');
    },
  });

  return (
    <article className="flex gap-4">
      {comment.user?.avatarUrl ? (
        <Image src={comment.user.avatarUrl} alt="" width={40} height={40} className="rounded-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-sm font-bold text-primary">
          {(comment.user?.displayName ?? '?')[0]}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-on-surface">{comment.user?.displayName ?? 'User'}</span>
          <span className="font-label-caps text-[10px] text-outline">{timeAgo(comment.createdAt)}</span>
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
          <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{comment.content}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                onGuestInteract?.();
                return;
              }
              likeMut.mutate();
            }}
            className={`font-semibold ${liked ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
          >
            {liked ? 'Liked' : 'Like'}
            {likeCount > 0 ? ` · ${formatCount(likeCount)}` : ''}
          </button>
          {depth === 0 && (
            <button
              type="button"
              onClick={() => {
                toggleReplies();
                onReply(comment.id);
              }}
              className="font-semibold text-primary hover:underline"
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
                onClick={() => {
                  if (window.confirm('Delete this comment?')) deleteMut.mutate();
                }}
                className="text-error hover:underline"
              >
                Delete
              </button>
            </>
          )}
          {!isOwn && currentUser && (
            <button type="button" onClick={() => setReportOpen(true)} className="text-on-surface-variant hover:text-primary">
              Report
            </button>
          )}
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
                depth={1}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <h3 className="font-semibold">Report comment</h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Why should we review this?"
              rows={3}
              className="mt-3 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setReportOpen(false)} className="px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={reportReason.trim().length < 3 || reportMut.isPending}
                onClick={() => reportMut.mutate()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export function CommentsPanel({
  videoId,
  commentCount = 0,
  onGuestInteract,
}: {
  videoId: string;
  commentCount?: number;
  onGuestInteract?: () => void;
}) {
  const [content, setContent] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const refreshComments = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['comments', videoId] });
  }, [queryClient, videoId]);

  const { data, isLoading } = useQuery({
    queryKey: ['comments', videoId],
    queryFn: async () => {
      const { data } = await api.get<{ data: CommentsResponse }>(`/videos/${videoId}/comments?limit=20`);
      return data.data;
    },
  });

  const loadMore = useCallback(async () => {
    if (!data?.meta.hasMore || !data.meta.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data: next } = await api.get<{ data: CommentsResponse }>(
        `/videos/${videoId}/comments?limit=20&cursor=${encodeURIComponent(data.meta.cursor)}`,
      );
      queryClient.setQueryData(['comments', videoId], {
        data: [...(data.data ?? []), ...next.data.data],
        meta: next.data.meta,
      });
    } finally {
      setLoadingMore(false);
    }
  }, [data, videoId, queryClient, loadingMore]);

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
      pollTimer = setInterval(onNewComment, 10000);
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
      <h3 className="font-display-forge text-xl font-semibold md:text-2xl">
        Discussion{' '}
        <span className="text-lg font-normal text-on-surface-variant">{formatCount(count)}</span>
      </h3>

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
            disabled={!user || post.isPending}
            className="w-full resize-none border-0 border-b border-outline-variant bg-transparent px-0 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-0 disabled:opacity-60"
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
            {data.data.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                videoId={videoId}
                onReply={setReplyToId}
                currentUser={user}
                onGuestInteract={onGuestInteract}
                onRefresh={refreshComments}
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
