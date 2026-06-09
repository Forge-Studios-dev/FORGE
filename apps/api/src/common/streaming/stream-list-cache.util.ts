/** Redis keys for cached live/upcoming stream list responses. */
export const STREAM_LIST_CACHE_PREFIX = 'streams:list:';

export function streamListCacheKey(kind: 'live' | 'upcoming', viewerKey: string): string {
  return `${STREAM_LIST_CACHE_PREFIX}${kind}:${viewerKey}`;
}

export function streamListViewerKey(viewerId?: string | null): string {
  return viewerId?.trim() || 'anon';
}
