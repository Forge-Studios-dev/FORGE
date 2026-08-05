'use client';

import { useEffect, useState } from 'react';
import { AUTH_SESSION_EVENT, getAccessToken } from '@/lib/auth-storage';
import { getSocket } from '@/lib/socket';
import { dispatchVideoReady } from '@/lib/video-events';

type Toast = { id: string; title: string; body?: string };

export function RealtimeToasts() {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : getAccessToken(),
  );
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const sync = () => setAccessToken(getAccessToken());
    sync();
    window.addEventListener(AUTH_SESSION_EVENT, sync);
    return () => window.removeEventListener(AUTH_SESSION_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    const onVideoReady = (payload: { videoId: string; message?: string }) => {
      dispatchVideoReady(payload);
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
  }, [accessToken]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((x) => x.slice(0, -1)), 4500);
    return () => clearTimeout(t);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 w-[320px]">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="glass-panel rounded-xl border border-outline-variant/20 p-4 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{toast.title}</p>
              {toast.body ? <p className="mt-1 text-sm text-on-surface-variant">{toast.body}</p> : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToasts((x) => x.filter((t) => t.id !== toast.id))}
              className="shrink-0 rounded-lg px-2 py-0.5 text-on-surface-variant hover:bg-outline-variant/20 hover:text-on-surface"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

