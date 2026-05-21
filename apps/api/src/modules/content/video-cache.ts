export const VIDEO_DETAIL_CACHE_PREFIX = 'video:detail:';

export function videoDetailCacheKey(videoId: string): string {
  return `${VIDEO_DETAIL_CACHE_PREFIX}${videoId}`;
}
