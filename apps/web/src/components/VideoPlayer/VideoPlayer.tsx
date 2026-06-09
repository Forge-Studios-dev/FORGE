'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/auth-storage';
import {
  trackWatchComplete,
  trackWatchProgress,
  trackWatchStartup,
} from '@/lib/analytics';

export interface VideoPlayerProps {
  videoId?: string;
  hlsUrl?: string;
  thumbnailUrl?: string;
  title: string;
  /** Lower segment latency for live HLS (Mux LL-HLS). */
  lowLatency?: boolean;
  /** Live stream — enables auto-reconnect and reconnect banner. */
  isLive?: boolean;
  /** Live DVR — seek within Mux buffer; shows Go Live when behind edge. */
  dvrEnabled?: boolean;
  /** Fires current playback position in seconds (for chat replay sync). */
  onPlaybackTime?: (seconds: number) => void;
  /** WebVTT caption track URL. */
  captionUrl?: string | null;
}

type QualityLevel = { index: number; label: string };

export function VideoPlayer({
  videoId,
  hlsUrl,
  thumbnailUrl,
  title,
  lowLatency,
  isLive,
  dvrEnabled,
  onPlaybackTime,
  captionUrl,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const attachHlsRef = useRef<() => void>(() => {});
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const lastProgressRef = useRef(0);
  const startupTrackedRef = useRef(false);
  const completeTrackedRef = useRef(false);
  const viewRecordedRef = useRef(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [pipSupported, setPipSupported] = useState(false);
  const [behindLiveEdge, setBehindLiveEdge] = useState(false);

  useEffect(() => {
    setPipSupported(typeof document !== 'undefined' && 'pictureInPictureEnabled' in document);
  }, []);

  const maybeRecordView = useCallback(
    (currentTime: number, duration: number) => {
      if (!videoId || viewRecordedRef.current) return;
      const threshold =
        duration > 0
          ? Math.max(3, Math.min(30, Math.floor(duration * 0.3)))
          : 30;
      if (currentTime < threshold) return;
      viewRecordedRef.current = true;
      void api
        .post(`/videos/${videoId}/view`, {
          progressSeconds: Math.floor(currentTime),
          durationSeconds: duration > 0 ? Math.floor(duration) : undefined,
        })
        .catch(() => {
          viewRecordedRef.current = false;
        });
    },
    [videoId],
  );

  const recordProgress = useCallback(
    async (seconds: number) => {
      if (!videoId || !getAccessToken()) return;
      if (Math.abs(seconds - lastProgressRef.current) < 5 && seconds > 0) return;
      lastProgressRef.current = seconds;
      trackWatchProgress(videoId, Math.floor(seconds));
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

  const scheduleReconnect = useCallback(() => {
    if (!isLive) return;
    setReconnecting(true);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    const delay = Math.min(30_000, 2000 * 2 ** retryCountRef.current);
    retryCountRef.current += 1;
    retryTimerRef.current = setTimeout(() => {
      attachHlsRef.current();
    }, delay);
  }, [isLive]);

  const attachHls = useCallback(() => {
    if (!hlsUrl || !videoRef.current) return;
    const video = videoRef.current;
    setPlaybackError(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: !!lowLatency,
        startLevel: -1,
        capLevelToPlayerSize: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const next: QualityLevel[] = [{ index: -1, label: 'Auto' }];
        data.levels.forEach((level, index) => {
          const height = level.height ?? 0;
          next.push({ index, label: height ? `${height}p` : `Level ${index + 1}` });
        });
        setLevels(next);
        setCurrentLevel(hls.currentLevel);
        retryCountRef.current = 0;
        setReconnecting(false);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentLevel(data.level);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (isLive && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          scheduleReconnect();
          return;
        }
        setReconnecting(false);
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
      retryCountRef.current = 0;
      setReconnecting(false);
    } else {
      setPlaybackError('HLS playback is not supported in this browser.');
    }
  }, [hlsUrl, lowLatency, isLive, scheduleReconnect]);

  useEffect(() => {
    attachHlsRef.current = attachHls;
  }, [attachHls]);

  const setQuality = (levelIndex: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = levelIndex;
    setCurrentLevel(levelIndex);
  };

  const enterPiP = async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      /* user cancelled or unsupported */
    }
  };

  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;
    const video = videoRef.current;

    const onTimeUpdate = () => {
      if (video.currentTime > 0) {
        onPlaybackTime?.(video.currentTime);
        if (isLive && dvrEnabled && Number.isFinite(video.duration) && video.duration > 0) {
          setBehindLiveEdge(video.duration - video.currentTime > 5);
        }
        void recordProgress(video.currentTime);
        maybeRecordView(video.currentTime, video.duration);
      }
      if (
        videoId &&
        !completeTrackedRef.current &&
        video.duration > 0 &&
        video.currentTime / video.duration >= 0.9
      ) {
        completeTrackedRef.current = true;
        trackWatchComplete(videoId, Math.floor(video.duration));
      }
    };

    const onPlaying = () => {
      if (videoId && !startupTrackedRef.current) {
        startupTrackedRef.current = true;
        trackWatchStartup(videoId, Math.round(performance.now()));
      }
      setReconnecting(false);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('playing', onPlaying);
    attachHls();

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('playing', onPlaying);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      void recordProgress(video.currentTime);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl, attachHls, recordProgress, maybeRecordView, videoId, onPlaybackTime, isLive, dvrEnabled]);

  const jumpToLive = () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, video.duration - 2);
    void video.play();
    setBehindLiveEdge(false);
  };

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
      >
        {captionUrl ? (
          <track kind="captions" src={captionUrl} srcLang="en" label="English" default />
        ) : null}
      </video>
      {isLive && dvrEnabled && behindLiveEdge ? (
        <button
          type="button"
          onClick={jumpToLive}
          className="absolute bottom-14 right-3 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-on-primary shadow-lg"
        >
          Go Live
        </button>
      ) : null}
      <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        {levels.length > 1 ? (
          <select
            aria-label="Playback quality"
            value={currentLevel}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="pointer-events-auto rounded-md border border-outline-variant/40 bg-surface/90 px-2 py-1 text-xs"
          >
            {levels.map((l) => (
              <option key={l.index} value={l.index}>
                {l.label}
              </option>
            ))}
          </select>
        ) : null}
        {pipSupported ? (
          <button
            type="button"
            onClick={() => void enterPiP()}
            className="pointer-events-auto rounded-md border border-outline-variant/40 bg-surface/90 px-2 py-1 text-xs hover:border-primary"
          >
            PiP
          </button>
        ) : null}
      </div>
      {reconnecting ? (
        <div className="absolute inset-x-0 top-0 bg-amber-600/90 px-3 py-2 text-center text-xs font-medium text-white">
          Reconnecting to live stream…
        </div>
      ) : null}
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
