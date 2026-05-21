'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { getAccessToken } from '@/lib/auth-storage';
import { VIDEO_READY_EVENT, dispatchVideoReady, type VideoReadyDetail } from '@/lib/video-events';
import { Video } from '@/types';
import { WatchExperience } from '@/components/watch/WatchExperience';

export function WatchPageClient({ video: initial }: { video: Video }) {
  const { data: video = initial, refetch } = useQuery({
    queryKey: ['video', initial.id],
    queryFn: async () => {
      const { data } = await api.get<{ data: Video }>(`/videos/${initial.id}`);
      return data.data;
    },
    initialData: initial,
    refetchInterval: (query) => {
      const v = query.state.data;
      if (!v || v.status === 'ready' || v.status === 'failed') return false;
      return 5000;
    },
  });

  useEffect(() => {
    const token = getAccessToken();
    const socket = token ? getSocket(token) : null;
    if (socket) {
      socket.emit('join-video', { videoId: initial.id });
      const onReady = (payload: VideoReadyDetail) => {
        if (payload.videoId === initial.id) dispatchVideoReady(payload);
      };
      socket.on('video:ready', onReady);
      return () => {
        socket.off('video:ready', onReady);
        socket.emit('leave-video', { videoId: initial.id });
      };
    }
    return undefined;
  }, [initial.id]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<VideoReadyDetail>).detail;
      if (detail?.videoId === initial.id) void refetch();
    };
    window.addEventListener(VIDEO_READY_EVENT, handler);
    return () => window.removeEventListener(VIDEO_READY_EVENT, handler);
  }, [initial.id, refetch]);

  return <WatchExperience video={video} />;
}
