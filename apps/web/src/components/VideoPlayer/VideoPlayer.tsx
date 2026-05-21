'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const hlsRef = useRef<Hls | null>(null);
  const lastProgressRef = useRef(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

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

  const attachHls = useCallback(() => {
    if (!hlsUrl || !videoRef.current) return;
    const video = videoRef.current;
    setPlaybackError(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: !!lowLatency });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        setPlaybackError(
          data.type === Hls.ErrorTypes.NETWORK_ERROR
            ? 'Network error loading video. Check your connection or try again.'
            : 'Playback failed. The video may still be processing.',
        );
      });
      return;
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
    } else {
      setPlaybackError('HLS playback is not supported in this browser.');
    }
  }, [hlsUrl, lowLatency]);

  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;
    const video = videoRef.current;

    const onTimeUpdate = () => {
      if (video.currentTime > 0) void recordProgress(video.currentTime);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    attachHls();

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      void recordProgress(video.currentTime);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl, attachHls, recordProgress]);

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
      {playbackError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/90 p-6 text-center">
          <p className="text-sm text-error">{playbackError}</p>
          <button
            type="button"
            className="rounded-full border border-outline-variant px-4 py-2 text-sm hover:border-primary"
            onClick={() => attachHls()}
          >
            Retry playback
          </button>
        </div>
      ) : null}
    </div>
  );
}
