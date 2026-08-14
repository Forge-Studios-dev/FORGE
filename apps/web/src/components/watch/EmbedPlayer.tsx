'use client';

import Link from 'next/link';
import { Video } from '@/types';
import { VideoPlayer } from '@/components/VideoPlayer/VideoPlayerLazy';
import { parseTimeQueryParam } from '@/lib/watch-url';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';

function EmbedPlayerInner({ video }: { video: Video }) {
  const searchParams = useSearchParams();
  const seekToSeconds = useMemo(() => {
    const t = parseTimeQueryParam(searchParams.get('t'));
    return t != null && t > 0 ? t : null;
  }, [searchParams]);

  const canPlay = video.status === 'ready' && !!video.hlsUrl && !video.accessDenied;

  if (!canPlay) {
    return (
      <div className="flex aspect-video items-center justify-center bg-black p-6 text-center">
        <div>
          <p className="text-sm text-white/80">This video can’t be embedded.</p>
          <Link href={`/watch/${video.id}`} className="mt-3 inline-block text-sm text-primary hover:underline">
            Watch on FORGE
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-black">
      <VideoPlayer
        videoId={video.id}
        hlsUrl={video.hlsUrl!}
        thumbnailUrl={video.thumbnailUrl}
        title={video.title}
        seekToSeconds={seekToSeconds}
        captionUrl={video.captionUrl}
        captionTracks={video.captionTracks}
      />
      <Link
        href={`/watch/${video.id}`}
        className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white hover:bg-black/90"
        target="_blank"
        rel="noopener noreferrer"
      >
        Watch on FORGE
      </Link>
    </div>
  );
}

export function EmbedPlayer({ video }: { video: Video }) {
  return (
    <Suspense
      fallback={<div className="aspect-video animate-pulse bg-surface-container/40" aria-hidden />}
    >
      <EmbedPlayerInner video={video} />
    </Suspense>
  );
}
