'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getAccessToken } from '@/lib/auth-storage';
import { Comment } from '@/types';
import { getSocket, joinRoom, leaveRoom } from '@/lib/socket';
import { formatCount, timeAgo } from '@/lib/utils';

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
  const { user } = useAuth();

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['comments', videoId],
    queryFn: async () => {
      const { data } = await api.get(`/videos/${videoId}/comments?limit=20`);
      return data.data as { data: Comment[] };
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      if (!content.trim()) return null;
      const { data } = await api.post(`/videos/${videoId}/comments`, { content: content.trim() });
      return data.data as Comment;
    },
    onSuccess: () => {
      setContent('');
      refetch();
    },
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!user?.id || !token) return;
    const socket = getSocket(token);
    if (!socket) return;

    joinRoom('join-video', { videoId });

    const onNewComment = () => refetch();
    socket.on('comment:new', onNewComment);

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => refetch(), 10000);
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
  }, [user?.id, videoId, refetch]);

  const count = data?.data?.length ?? commentCount;

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
          data.data.map((c) => (
            <article key={c.id} className="flex gap-4">
              {c.user?.avatarUrl ? (
                <Image src={c.user.avatarUrl} alt="" width={40} height={40} className="rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-sm font-bold text-primary">
                  {(c.user?.displayName ?? '?')[0]}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-on-surface">{c.user?.displayName ?? 'User'}</span>
                  <span className="font-label-caps text-[10px] text-outline">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{c.content}</p>
              </div>
            </article>
          ))
        ) : (
          <p className="text-sm text-on-surface-variant">No comments yet. Start the discussion.</p>
        )}
      </div>
    </section>
  );
}
