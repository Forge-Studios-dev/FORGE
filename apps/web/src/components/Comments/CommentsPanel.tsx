'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, serverApi } from '@/lib/api';
import { Comment } from '@/types';
import { getSocket, joinRoom, leaveRoom } from '@/lib/socket';

function getStoredUserId(): string | null {
  try {
    const raw = localStorage.getItem('forge_user');
    if (!raw) return null;
    const user = JSON.parse(raw) as { id?: string };
    return user.id || null;
  } catch {
    return null;
  }
}

export function CommentsPanel({ videoId }: { videoId: string }) {
  const [content, setContent] = useState('');
  const userId = useMemo(() => (typeof window === 'undefined' ? null : getStoredUserId()), []);

  const { data, refetch } = useQuery({
    queryKey: ['comments', videoId],
    queryFn: async () => {
      const { data } = await serverApi.get(`/videos/${videoId}/comments?limit=20`);
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
    if (!userId) return;
    const socket = getSocket(userId);
    if (!socket) return;

    joinRoom('join-video', { videoId });

    const onNewComment = () => {
      refetch();
    };

    socket.on('comment:new', onNewComment);

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        refetch();
      }, 10000);
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
    const onDisconnect = () => {
      startPolling();
    };

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
  }, [userId, videoId, refetch]);

  return (
    <section className="glass rounded-xl p-5 border border-white/10">
      <h3 className="text-lg font-semibold">Comments</h3>

      <div className="mt-4 flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={userId ? 'Add a comment…' : 'Sign in to comment'}
          disabled={!userId || post.isPending}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-forge-500 transition disabled:opacity-60"
        />
        <button
          onClick={() => post.mutate()}
          disabled={!userId || post.isPending || !content.trim()}
          className="bg-forge-600 hover:bg-forge-500 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-lg transition"
        >
          Post
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {data?.data?.length ? (
          data.data.map((c) => (
            <div key={c.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-sm font-semibold">{c.user.displayName}</p>
              <p className="text-sm text-gray-300 mt-1 whitespace-pre-line">{c.content}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400">No comments yet.</p>
        )}
      </div>
    </section>
  );
}

