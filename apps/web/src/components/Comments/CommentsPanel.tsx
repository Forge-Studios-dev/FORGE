'use client';

import { useEffect, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getAccessToken } from '@/lib/auth-storage';
import { getSocket, joinRoom, leaveRoom } from '@/lib/socket';
import { formatCount } from '@/lib/utils';
import {
  type CommentSort,
  createComment,
  getComment,
  listComments,
} from '@/lib/comments-api';
import { Button } from '@forge/design-system';
import { CommentRow } from './CommentRow';

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
    queryFn: async () => getComment(videoId, highlightId!),
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
    queryFn: async () => listComments(videoId, { limit: 20, sort }),
  });

  const loadMore = useCallback(async () => {
    if (!data?.meta.hasMore || !data.meta.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await listComments(videoId, {
        limit: 20,
        sort,
        cursor: data.meta.cursor,
      });
      queryClient.setQueryData(['comments', videoId, sort], {
        data: [...(data.data ?? []), ...next.data],
        meta: next.meta,
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
      return createComment(videoId, body);
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
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                if (!user && onGuestInteract) {
                  onGuestInteract();
                  return;
                }
                post.mutate();
              }}
              disabled={!user || post.isPending || !content.trim()}
              className="px-4 py-2"
            >
              Post
            </Button>
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
