import { sanitizeThumbnailUrl } from './playback-url.util';

export function muxHlsPlaybackUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

export function muxThumbnailUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=1280&height=720&fit_mode=smartcrop`;
}

/** Extract Mux playback id from an HLS manifest URL. */
export function muxPlaybackIdFromHlsUrl(hlsUrl: string | null | undefined): string | null {
  if (!hlsUrl || typeof hlsUrl !== 'string') return null;
  const match = hlsUrl.trim().match(/stream\.mux\.com\/([A-Za-z0-9_-]+)(?:\.m3u8)?/i);
  return match?.[1] ?? null;
}

type StreamThumbnailSource = {
  thumbnailUrl?: string | null;
  playbackUrl?: string | null;
  user?: { avatarUrl?: string | null } | null;
};

/**
 * Poster for live streams: explicit upload → Mux live frame → creator avatar.
 */
export function resolveStreamThumbnailUrl(stream: StreamThumbnailSource): string | null {
  const stored = sanitizeThumbnailUrl(stream.thumbnailUrl);
  if (stored) return stored;

  const playbackId = muxPlaybackIdFromHlsUrl(stream.playbackUrl);
  if (playbackId) return muxThumbnailUrl(playbackId);

  const avatar = stream.user?.avatarUrl;
  if (avatar && typeof avatar === 'string') {
    const safe = sanitizeThumbnailUrl(avatar);
    if (safe) return safe;
  }

  return null;
}
