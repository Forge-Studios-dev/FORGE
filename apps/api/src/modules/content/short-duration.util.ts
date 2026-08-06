import {
  SHORT_DURATION_THRESHOLD_SECONDS,
  VideoType,
} from './entities/video.entity';

export const SHORT_TOO_LONG_MESSAGE =
  'Shorts must be 60 seconds or shorter. Upload as a regular video instead.';

export type ShortDurationResolution =
  | { ok: true; videoType: VideoType.VIDEO | VideoType.SHORT | VideoType.PODCAST }
  | { ok: false; reason: string };

/**
 * Resolve final videoType when duration is known (Mux/ffmpeg ready).
 * Short intent + duration > 60s → hard reject (YouTube parity).
 * Video intent + duration ≤ 60s → auto-classify as Short.
 */
export function resolveVideoTypeOnReady(
  intent: VideoType,
  durationSeconds: number | null,
): ShortDurationResolution {
  const duration =
    durationSeconds !== null && Number.isFinite(durationSeconds)
      ? Math.round(durationSeconds)
      : null;

  if (intent === VideoType.PODCAST) {
    return { ok: true, videoType: VideoType.PODCAST };
  }

  if (intent === VideoType.SHORT) {
    if (duration !== null && duration > SHORT_DURATION_THRESHOLD_SECONDS) {
      return { ok: false, reason: SHORT_TOO_LONG_MESSAGE };
    }
    return { ok: true, videoType: VideoType.SHORT };
  }

  if (duration !== null && duration <= SHORT_DURATION_THRESHOLD_SECONDS) {
    return { ok: true, videoType: VideoType.SHORT };
  }
  return { ok: true, videoType: VideoType.VIDEO };
}

/**
 * Studio detail editor may reclassify Video ↔ Short. Returns an error message when
 * Short is requested but duration is known and over the YouTube 60s threshold.
 */
export function shortTypeChangeError(
  nextType: VideoType,
  durationSeconds: number | null | undefined,
): string | null {
  if (nextType !== VideoType.SHORT) return null;
  if (
    durationSeconds != null &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > SHORT_DURATION_THRESHOLD_SECONDS
  ) {
    return SHORT_TOO_LONG_MESSAGE;
  }
  return null;
}
