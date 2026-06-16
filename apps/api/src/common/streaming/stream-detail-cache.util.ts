/** Redis key for cached stream entity (findById / entitlement hot path). */
export const STREAM_DETAIL_CACHE_PREFIX = 'stream:detail:';

export const STREAM_DETAIL_CACHE_TTL_SEC = 25;

export function streamDetailCacheKey(streamId: string): string {
  return `${STREAM_DETAIL_CACHE_PREFIX}${streamId}`;
}
