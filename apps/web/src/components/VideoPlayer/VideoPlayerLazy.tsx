'use client';

import dynamic from 'next/dynamic';
import type { VideoPlayerProps } from './VideoPlayer';

const VideoPlayerSkeleton = () => (
  <div
    className="glass-panel aspect-video w-full animate-pulse rounded-xl bg-surface-container/40"
    aria-hidden
  />
);

const VideoPlayerDynamic = dynamic<VideoPlayerProps>(
  () => import('./VideoPlayer').then((m) => m.VideoPlayer),
  { ssr: false, loading: () => <VideoPlayerSkeleton /> },
);

export function VideoPlayer(props: VideoPlayerProps) {
  return <VideoPlayerDynamic {...props} />;
}
