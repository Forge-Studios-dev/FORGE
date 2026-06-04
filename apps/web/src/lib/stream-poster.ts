import type { Stream, User } from '@/types';

/** Client-side poster fallback when API has not yet persisted a Mux frame. */
export function resolveStreamPoster(stream: Pick<Stream, 'thumbnailUrl' | 'playbackUrl' | 'user'>): string | null {
  if (stream.thumbnailUrl) return stream.thumbnailUrl;

  const playback = stream.playbackUrl?.trim();
  if (playback) {
    const match = playback.match(/stream\.mux\.com\/([A-Za-z0-9_-]+)(?:\.m3u8)?/i);
    if (match?.[1]) {
      return `https://image.mux.com/${match[1]}/thumbnail.jpg?width=1280&height=720&fit_mode=smartcrop`;
    }
  }

  const avatar = (stream.user as User | undefined)?.avatarUrl;
  return avatar?.trim() || null;
}
