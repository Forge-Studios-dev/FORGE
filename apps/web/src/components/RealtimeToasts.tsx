'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSocket } from '@/lib/socket';

type Toast = { id: string; title: string; body?: string };

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

export function RealtimeToasts() {
  const userId = useMemo(() => (typeof window === 'undefined' ? null : getStoredUserId()), []);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!userId) return;
    const socket = getSocket(userId);
    if (!socket) return;

    const onVideoReady = (payload: { videoId: string; message?: string }) => {
      setToasts((t) => [
        { id: `video:${payload.videoId}:${Date.now()}`, title: 'Video ready', body: payload.message },
        ...t,
      ].slice(0, 3));
    };

    const onStreamStarted = (payload: { title?: string }) => {
      setToasts((t) => [
        { id: `stream:${Date.now()}`, title: 'Live started', body: payload.title },
        ...t,
      ].slice(0, 3));
    };

    socket.on('video:ready', onVideoReady);
    socket.on('stream:started', onStreamStarted);

    return () => {
      socket.off('video:ready', onVideoReady);
      socket.off('stream:started', onStreamStarted);
    };
  }, [userId]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((x) => x.slice(0, -1)), 4500);
    return () => clearTimeout(t);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 w-[320px]">
      {toasts.map((toast) => (
        <div key={toast.id} className="glass rounded-xl border border-white/10 p-4 shadow-lg">
          <p className="font-semibold">{toast.title}</p>
          {toast.body ? <p className="text-sm text-gray-400 mt-1">{toast.body}</p> : null}
        </div>
      ))}
    </div>
  );
}

