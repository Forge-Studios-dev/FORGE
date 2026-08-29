'use client';

import { Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket, joinRoom, leaveRoom } from '@/lib/socket';
import { getAccessToken } from '@/lib/auth-storage';
import { VIDEO_READY_EVENT, dispatchVideoReady, type VideoReadyDetail } from '@/lib/video-events';
import { Video } from '@/types';
import { WatchExperience } from '@/components/watch/WatchExperience';
import { preloadHlsManifests } from '@/lib/hls-preload';

function WatchPageBody({
  video: initial,
  sidebar,
}: {
  video: Video;
  sidebar?: React.ReactNode;
}) {
  const { data: video = initial, refetch } = useQuery({
    queryKey: ['video', initial.id],
    queryFn: async () => {
      const { data } = await api.get<{ data: Video }>(`/videos/${initial.id}`);
      return data.data;
    },
    initialData: initial,
    refetchOnMount: initial.status === 'ready' || initial.status === 'failed' ? false : true,
    refetchInterval: (query) => {
      const v = query.state.data;
      if (!v || v.status === 'ready' || v.status === 'failed') return false;
      const token = getAccessToken();
      const socket = token ? getSocket(token) : null;
      if (socket?.connected) return false;
      return 30_000;
    },
  });

  useEffect(() => {
    const token = getAccessToken();
    const socket = token ? getSocket(token) : null;
    if (socket) {
      const join = () => {
        void joinRoom('join-video', { videoId: initial.id });
      };
      join();
      const onReady = (payload: VideoReadyDetail) => {
        if (payload.videoId === initial.id) dispatchVideoReady(payload);
      };
      const onConnect = () => join();
      socket.on('video:ready', onReady);
      socket.on('connect', onConnect);
      return () => {
        socket.off('video:ready', onReady);
        socket.off('connect', onConnect);
        leaveRoom('leave-video', { videoId: initial.id });
      };
    }
    return undefined;
  }, [initial.id]);

  useEffect(() => {
    preloadHlsManifests([video.hlsUrl], 1);
  }, [video.hlsUrl]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<VideoReadyDetail>).detail;
      if (detail?.videoId === initial.id) void refetch();
    };
    window.addEventListener(VIDEO_READY_EVENT, handler);
    return () => window.removeEventListener(VIDEO_READY_EVENT, handler);
  }, [initial.id, refetch]);

  return <WatchExperience video={video} sidebar={sidebar} />;
}

export function WatchPageClient({
  video,
  sidebar,
}: {
  video: Video;
  sidebar?: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
          <div className="aspect-video animate-pulse rounded-xl bg-surface-container/40" />
        </main>
      }
    >
      <WatchPageBody video={video} sidebar={sidebar} />
    </Suspense>
  );
}
