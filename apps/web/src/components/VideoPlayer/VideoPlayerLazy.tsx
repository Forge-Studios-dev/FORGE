'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { VideoPlayerProps } from './VideoPlayer';

function createLazyPlayer(shorts: boolean): ComponentType<VideoPlayerProps> {
  return dynamic(() => import('./VideoPlayer').then((m) => m.VideoPlayer), {
    ssr: false,
    loading: () => (
      <div
        className={
          shorts
            ? 'h-full w-full animate-pulse bg-black/40'
            : 'glass-panel aspect-video w-full animate-pulse rounded-xl bg-surface-container/40'
        }
        aria-hidden
      />
    ),
  });
}

const DefaultLazy = createLazyPlayer(false);
const ShortsLazy = createLazyPlayer(true);

export function VideoPlayer(props: VideoPlayerProps) {
  const Lazy = props.variant === 'shorts' ? ShortsLazy : DefaultLazy;
  return <Lazy {...props} />;
}
