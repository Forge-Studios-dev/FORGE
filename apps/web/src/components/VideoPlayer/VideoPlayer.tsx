'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Icon } from '@forge/design-system';
import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/auth-storage';
import {
  trackWatchComplete,
  trackWatchProgress,
  trackWatchStartup,
} from '@/lib/analytics';
import { isWatchHistoryPaused } from '@/lib/watch-history-prefs';
import {
  ALLOWED_RATES,
  readPreferredPlaybackRate,
  readPreferredVolume,
  writePreferredPlaybackRate,
  writePreferredVolume,
} from '@/lib/playback-prefs';

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
  /** Fired when VOD playback reaches the end (for Up next / autoplay). */
  onEnded?: () => void;
  /** Seek VOD to this second when set (description timestamps). */
  seekToSeconds?: number | null;
  /** Loop VOD when true (YouTube-style loop). */
  loop?: boolean;
  /** Request floating miniplayer (keyboard `i`). */
  onMiniplayer?: () => void;
  /** WebVTT caption track URL (legacy single track). */
  captionUrl?: string | null;
  /** Multi-language WebVTT tracks. */
  captionTracks?: { language: string; label: string; url: string }[] | null;
  /** Vertical Shorts chrome — fill frame, cover crop, minimal overlays. */
  variant?: 'default' | 'shorts';
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
  onEnded,
  seekToSeconds,
  loop = false,
  onMiniplayer,
  captionUrl,
  captionTracks,
  variant = 'default',
}: VideoPlayerProps) {
  const isShorts = variant === 'shorts';
  const tracks =
    captionTracks && captionTracks.length > 0
      ? captionTracks
      : captionUrl
        ? [{ language: 'en', label: 'English', url: captionUrl }]
        : [];
  const hasCaptions = tracks.length > 0;
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
  const [playbackRate, setPlaybackRate] = useState(1);
  const [pipSupported, setPipSupported] = useState(false);
  const [behindLiveEdge, setBehindLiveEdge] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [seekFlash, setSeekFlash] = useState<'back' | 'fwd' | null>(null);
  const seekFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shortsMuted, setShortsMuted] = useState(false);

  const flashSeek = (dir: 'back' | 'fwd') => {
    setSeekFlash(dir);
    if (seekFlashTimer.current) clearTimeout(seekFlashTimer.current);
    seekFlashTimer.current = setTimeout(() => setSeekFlash(null), 600);
  };

  useEffect(() => {
    setPipSupported(
      typeof document !== 'undefined' &&
        'pictureInPictureEnabled' in document &&
        !!document.pictureInPictureEnabled,
    );
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isLive) return;
    const rate = readPreferredPlaybackRate();
    const { volume, muted } = readPreferredVolume();
    video.playbackRate = rate;
    setPlaybackRate(rate);
    video.volume = volume;
    video.muted = muted;
    if (isShorts) setShortsMuted(muted);
  }, [hlsUrl, isLive, isShorts]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isLive) return;
    const persist = () => writePreferredVolume(video.volume, video.muted);
    video.addEventListener('volumechange', persist);
    return () => video.removeEventListener('volumechange', persist);
  }, [hlsUrl, isLive]);

  useEffect(() => {
    if (seekToSeconds == null || !Number.isFinite(seekToSeconds) || isLive) return;
    const video = videoRef.current;
    if (!video) return;
    const target = Math.max(0, seekToSeconds);
    const apply = () => {
      video.currentTime = Number.isFinite(video.duration)
        ? Math.min(target, Math.max(0, video.duration - 0.25))
        : target;
      void video.play().catch(() => undefined);
    };
    if (video.readyState >= 1) apply();
    else video.addEventListener('loadedmetadata', apply, { once: true });
  }, [seekToSeconds, isLive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isLive) return;
    video.loop = !!loop;
  }, [loop, isLive, hlsUrl]);

  const enterPiP = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (isLive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const video = videoRef.current;
      if (!video) return;

      const key = e.key.toLowerCase();
      if (key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (key === 'escape') {
        setShowShortcuts(false);
        return;
      }
      if (key === 'k' || key === ' ') {
        e.preventDefault();
        if (video.paused) void video.play();
        else video.pause();
        return;
      }
      if (key === 'j') {
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        return;
      }
      if (key === 'l') {
        e.preventDefault();
        const next = video.currentTime + 10;
        video.currentTime = Number.isFinite(video.duration)
          ? Math.min(video.duration, next)
          : next;
        return;
      }
      if (key === 'arrowleft') {
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
        return;
      }
      if (key === 'arrowright') {
        e.preventDefault();
        const next = video.currentTime + 5;
        video.currentTime = Number.isFinite(video.duration)
          ? Math.min(video.duration, next)
          : next;
        return;
      }
      if (key === 'arrowup') {
        e.preventDefault();
        video.volume = Math.min(1, Math.round((video.volume + 0.05) * 100) / 100);
        writePreferredVolume(video.volume, video.muted);
        return;
      }
      if (key === 'arrowdown') {
        e.preventDefault();
        video.volume = Math.max(0, Math.round((video.volume - 0.05) * 100) / 100);
        writePreferredVolume(video.volume, video.muted);
        return;
      }
      if (key === '<' || (e.shiftKey && key === ',')) {
        e.preventDefault();
        const rates = [...ALLOWED_RATES];
        const idx = rates.findIndex((r) => Math.abs(r - video.playbackRate) < 0.01);
        const next = rates[Math.max(0, (idx < 0 ? rates.indexOf(1) : idx) - 1)];
        video.playbackRate = next;
        setPlaybackRate(next);
        writePreferredPlaybackRate(next);
        return;
      }
      if (key === '>' || (e.shiftKey && key === '.')) {
        e.preventDefault();
        const rates = [...ALLOWED_RATES];
        const idx = rates.findIndex((r) => Math.abs(r - video.playbackRate) < 0.01);
        const next = rates[Math.min(rates.length - 1, (idx < 0 ? rates.indexOf(1) : idx) + 1)];
        video.playbackRate = next;
        setPlaybackRate(next);
        writePreferredPlaybackRate(next);
        return;
      }
      if (key === 'm') {
        e.preventDefault();
        video.muted = !video.muted;
        writePreferredVolume(video.volume, video.muted);
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        onMiniplayer?.();
        return;
      }
      if (key === 'p' && pipSupported) {
        e.preventDefault();
        void enterPiP();
        return;
      }
      if (key === 'f') {
        e.preventDefault();
        const root = video.parentElement;
        if (!document.fullscreenElement) {
          void (root ?? video).requestFullscreen?.();
        } else {
          void document.exitFullscreen();
        }
        return;
      }
      if (key === 'c' && hasCaptions) {
        e.preventDefault();
        const track = video.textTracks?.[0];
        if (track) {
          track.mode = track.mode === 'showing' ? 'hidden' : 'showing';
        }
        return;
      }
      if (/^[0-9]$/.test(key) && video.duration > 0) {
        e.preventDefault();
        video.currentTime = (Number(key) / 10) * video.duration;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLive, hasCaptions, onMiniplayer, pipSupported, enterPiP]);

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
      if (isWatchHistoryPaused()) return;
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

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    writePreferredPlaybackRate(rate);
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

    const handleEnded = () => {
      if (!isLive) onEnded?.();
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', handleEnded);
    attachHls();

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', handleEnded);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      void recordProgress(video.currentTime);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl, attachHls, recordProgress, maybeRecordView, videoId, onPlaybackTime, onEnded, isLive, dvrEnabled]);

  const jumpToLive = () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, video.duration - 2);
    void video.play();
    setBehindLiveEdge(false);
  };

  if (!hlsUrl) {
    return (
      <div
        className={`glass-panel flex flex-col items-center justify-center p-8 text-center ${
          isShorts ? 'h-full w-full rounded-none' : 'aspect-video rounded-xl'
        }`}
      >
        <p className="text-sm text-on-surface-variant">Video is being processed…</p>
      </div>
    );
  }

  return (
    <div
      className={
        isShorts
          ? 'group relative h-full w-full overflow-hidden bg-black'
          : 'group relative aspect-video overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
      }
    >
      <video
        ref={videoRef}
        controls={!isShorts}
        poster={thumbnailUrl}
        className={isShorts ? 'h-full w-full object-cover' : 'h-full w-full object-contain'}
        title={title}
        playsInline
        onDoubleClick={(e) => {
          if (isLive || isShorts) return;
          const video = videoRef.current;
          if (!video) return;
          e.preventDefault();
          const rect = video.getBoundingClientRect();
          const leftHalf = e.clientX - rect.left < rect.width / 2;
          if (leftHalf) {
            video.currentTime = Math.max(0, video.currentTime - 10);
            flashSeek('back');
          } else {
            const next = video.currentTime + 10;
            video.currentTime = Number.isFinite(video.duration)
              ? Math.min(video.duration, next)
              : next;
            flashSeek('fwd');
          }
        }}
      >
        {tracks.map((t, i) => (
          <track
            key={`${t.language}-${t.url}`}
            kind="captions"
            src={t.url}
            srcLang={t.language}
            label={t.label}
            default={i === 0}
          />
        ))}
      </video>
      {seekFlash && !isLive && !isShorts ? (
        <div
          className={`pointer-events-none absolute inset-y-0 flex w-1/3 items-center justify-center text-2xl font-bold text-white drop-shadow ${
            seekFlash === 'back' ? 'left-0 bg-gradient-to-r from-black/40 to-transparent' : 'right-0 bg-gradient-to-l from-black/40 to-transparent'
          }`}
          aria-hidden
        >
          {seekFlash === 'back' ? '−10s' : '+10s'}
        </div>
      ) : null}
      {isLive && dvrEnabled && behindLiveEdge ? (
        <button
          type="button"
          onClick={jumpToLive}
          aria-label="Jump to live"
          className="absolute bottom-14 right-3 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-on-primary shadow-lg"
        >
          Go Live
        </button>
      ) : null}
      {!isShorts ? (
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
        {!isLive ? (
          <select
            aria-label="Playback speed"
            value={playbackRate}
            onChange={(e) => changePlaybackRate(Number(e.target.value))}
            className="pointer-events-auto rounded-md border border-outline-variant/40 bg-surface/90 px-2 py-1 text-xs"
          >
            {[...ALLOWED_RATES].map((rate) => (
              <option key={rate} value={rate}>
                {rate === 1 ? 'Normal' : `${rate}×`}
              </option>
            ))}
          </select>
        ) : null}
        {pipSupported ? (
          <button
            type="button"
            onClick={() => void enterPiP()}
            aria-label="Picture in picture"
            className="pointer-events-auto rounded-md border border-outline-variant/40 bg-surface/90 px-2 py-1 text-xs hover:border-primary"
          >
            PiP
          </button>
        ) : null}
      </div>
      ) : (
        <button
          type="button"
          aria-label={shortsMuted ? 'Unmute' : 'Mute'}
          aria-pressed={shortsMuted}
          className="absolute left-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            video.muted = !video.muted;
            setShortsMuted(video.muted);
            writePreferredVolume(video.volume, video.muted);
          }}
        >
          <Icon name={shortsMuted ? 'volume_off' : 'volume_up'} className="text-xl text-white" />
        </button>
      )}
      {reconnecting ? (
        <div className="absolute inset-x-0 top-0 bg-warning px-3 py-2 text-center text-xs font-medium text-on-warning">
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
      {showShortcuts && !isLive && !isShorts ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-label="Keyboard shortcuts"
        >
          <div className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-surface-container-high p-5 text-sm text-on-surface shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display-forge text-lg font-semibold">Keyboard shortcuts</h3>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                Close
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {[
                ['k / Space', 'Play / pause'],
                ['j / ←', 'Seek back'],
                ['l / →', 'Seek forward'],
                ['m', 'Mute'],
                ['↑ / ↓', 'Volume'],
                ['f', 'Fullscreen'],
                ['c', 'Captions'],
                ['< / >', 'Slower / faster'],
                ['i', 'Miniplayer'],
                ['p', 'Picture in picture'],
                ['t', 'Theater mode'],
                ['0–9', 'Jump to % of video'],
                ['?', 'Toggle this help'],
                ['Double-click', 'Seek ±10s (side)'],
              ].map(([keys, label]) => (
                <li key={keys} className="flex justify-between gap-4 border-b border-outline-variant/20 py-1.5">
                  <span className="font-mono text-xs text-primary">{keys}</span>
                  <span className="text-on-surface-variant">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
