'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@forge/design-system/client';
import { AUTH_SESSION_EVENT, getAccessToken } from '@/lib/auth-storage';
import { getSocket } from '@/lib/socket';
import { dispatchVideoReady } from '@/lib/video-events';

export function RealtimeToasts() {
  const { toast } = useToast();
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : getAccessToken(),
  );

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
      toast({
        title: 'Video ready',
        description: payload.message,
        duration: 4500,
      });
    };

    const onStreamStarted = (payload: { title?: string }) => {
      toast({
        title: 'Live started',
        description: payload.title,
        duration: 4500,
      });
    };

    socket.on('video:ready', onVideoReady);
    socket.on('stream:started', onStreamStarted);

    return () => {
      socket.off('video:ready', onVideoReady);
      socket.off('stream:started', onStreamStarted);
    };
  }, [accessToken, toast]);

  return null;
}
