'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/lib/auth';
import {
  LIVE_STREAMS_QUERY_KEY,
  UPCOMING_STREAMS_QUERY_KEY,
} from '@/hooks/useLiveStreamsQuery';

/**
 * Single app-wide socket subscription for live stream list invalidation.
 * Mounted once in Providers — avoids duplicate join-live-feed per component.
 */
export function LiveStreamsSocketSync() {
  const queryClient = useQueryClient();
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: LIVE_STREAMS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: UPCOMING_STREAMS_QUERY_KEY });
    };

    socket.emit('join-live-feed');
    socket.on('stream:started', invalidate);
    socket.on('stream:ended', invalidate);

    return () => {
      socket.off('stream:started', invalidate);
      socket.off('stream:ended', invalidate);
      socket.emit('leave-live-feed');
    };
  }, [accessToken, queryClient]);

  return null;
}
