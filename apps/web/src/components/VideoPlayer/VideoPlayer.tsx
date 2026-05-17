'use client';

import { useCallback, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/auth-storage';

interface Props {
  videoId?: string;
  hlsUrl?: string;
  thumbnailUrl?: string;
  title: string;
  /** Lower segment latency for live HLS (Mux LL-HLS). */
  lowLatency?: boolean;
}

export function VideoPlayer({ videoId, hlsUrl, thumbnailUrl, title, lowLatency }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastProgressRef = useRef(0);

  const recordProgress = useCallback(
    async (seconds: number) => {
      if (!videoId || !getAccessToken()) return;
      if (Math.abs(seconds - lastProgressRef.current) < 5 && seconds > 0) return;
      lastProgressRef.current = seconds;
      try {
        await api.post(`/videos/${videoId}/watch`, {
          progressSeconds: Math.floor(seconds),
        });
      } catch {
        /* non-blocking */
      }
    },
    [videoId],
  );

  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;
    const video = videoRef.current;

    const onTimeUpdate = () => {
      if (video.currentTime > 0) void recordProgress(video.currentTime);
    };

    video.addEventListener('timeupdate', onTimeUpdate);

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: !!lowLatency });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      return () => {
        video.removeEventListener('timeupdate', onTimeUpdate);
        void recordProgress(video.currentTime);
        hls.destroy();
      };
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
    }
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      void recordProgress(video.currentTime);
    };
  }, [hlsUrl, lowLatency, recordProgress]);

  if (!hlsUrl) {
    return (
      <div className="glass-panel flex aspect-video flex-col items-center justify-center rounded-xl p-8 text-center">
        <p className="text-sm text-on-surface-variant">Video is being processed…</p>
      </div>
    );
  }

  return (
    <div className="group relative aspect-video overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <video
        ref={videoRef}
        controls
        poster={thumbnailUrl}
        className="h-full w-full object-contain"
        title={title}
        playsInline
      />
    </div>
  );
}
