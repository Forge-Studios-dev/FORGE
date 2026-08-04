'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Hls from 'hls.js';
import { Icon } from '@forge/design-system';
import { useMiniPlayer } from '@/lib/miniplayer';

/**
 * YouTube-style floating miniplayer — continues HLS playback after leaving watch.
 * Hidden on the same watch page (full player owns playback).
 */
export function MiniPlayerDock() {
  const { session, close, updateSeconds } = useMiniPlayer();
  const pathname = usePathname();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const onSameWatch =
    !!session &&
    (pathname === `/watch/${session.videoId}` || pathname.startsWith(`/watch/${session.videoId}?`));

  useEffect(() => {
    if (!session || onSameWatch) return;
    const video = videoRef.current;
    if (!video || !session.hlsUrl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const startAt = Math.max(0, session.seconds);
    const seekAndPlay = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.min(startAt, Math.max(0, video.duration - 0.25));
      } else {
        video.currentTime = startAt;
      }
      void video.play().catch(() => undefined);
    };

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, startLevel: -1, maxBufferLength: 20 });
      hlsRef.current = hls;
      hls.loadSource(session.hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => seekAndPlay());
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = session.hlsUrl;
      video.addEventListener('loadedmetadata', seekAndPlay, { once: true });
    }

    const onTime = () => updateSeconds(video.currentTime);
    video.addEventListener('timeupdate', onTime);

    return () => {
      video.removeEventListener('timeupdate', onTime);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [session, onSameWatch, updateSeconds]);

  if (!session || onSameWatch) return null;

  const expandHref = `/watch/${session.videoId}?t=${Math.floor(session.seconds)}`;

  return (
    <div
      className="fixed bottom-20 right-3 z-40 w-[min(100%-1.5rem,22rem)] overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-high shadow-2xl md:bottom-6 md:right-6"
      role="complementary"
      aria-label="Miniplayer"
    >
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          controls
          poster={session.thumbnailUrl ?? undefined}
          title={session.title}
        />
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <Link
          href={expandHref}
          className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface hover:text-primary"
          title={session.title}
        >
          {session.title}
        </Link>
        <button
          type="button"
          aria-label="Expand to watch page"
          onClick={() => router.push(expandHref)}
          className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        >
          <Icon name="open_in_full" className="text-lg" />
        </button>
        <button
          type="button"
          aria-label="Close miniplayer"
          onClick={close}
          className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        >
          <Icon name="close" className="text-lg" />
        </button>
      </div>
    </div>
  );
}
