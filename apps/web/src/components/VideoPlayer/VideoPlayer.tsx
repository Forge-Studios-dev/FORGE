'use client';

import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface Props {
  hlsUrl?: string;
  thumbnailUrl?: string;
  title: string;
}

export function VideoPlayer({ hlsUrl, thumbnailUrl, title }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      return () => hls.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
    }
  }, [hlsUrl]);

  if (!hlsUrl) {
    return (
      <div className="aspect-video bg-surface-card rounded-xl flex items-center justify-center">
        <p className="text-gray-400 text-sm">Video is being processed…</p>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-black rounded-xl overflow-hidden">
      <video
        ref={videoRef}
        controls
        poster={thumbnailUrl}
        className="w-full h-full"
        title={title}
        playsInline
      />
    </div>
  );
}
