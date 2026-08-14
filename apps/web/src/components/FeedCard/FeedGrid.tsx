'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFeedScrollRestore } from '@/lib/use-feed-scroll-restore';
import { chunkFeedRows, estimateFeedRowHeight, useFeedColumns } from '@/lib/use-feed-columns';
import { PaginatedResponse, Video } from '@/types';
import { FeedCard } from './FeedCard';
import { preloadHlsManifests } from '@/lib/hls-preload';
import { EmptyState } from '@forge/design-system';

/** With row virtualization, allow more cached pages; DOM stays bounded. */
const MAX_FEED_PAGES = 10;
interface Props {
  initialData: PaginatedResponse<Video>;
  categorySlug?: string;
  skillTagSlug?: string;
  feedPath?: string;
  sort?: 'latest' | 'popular' | 'forYou' | 'following';
  /** Filter following feed to one channel (subscriptions). */
  channelId?: string;
}

export function FeedGrid({
  initialData,
  categorySlug: categorySlugProp,
  skillTagSlug,
  feedPath = '/videos/feed',
  sort,
  channelId,
}: Props) {
  const searchParams = useSearchParams();
  const categorySlug = categorySlugProp ?? searchParams.get('category') ?? undefined;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const listAnchorRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [mutedChannels, setMutedChannels] = useState<Set<string>>(() => new Set());
  const columnCount = useFeedColumns();
  const { isGuest, isLoading: authLoading, canViewPersonalizedFeed } = useAuth();
  useFeedScrollRestore(feedPath === '/videos/feed' && !skillTagSlug);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    refetch,
    isFetchNextPageError,
  } = useInfiniteQuery({
    queryKey: ['feed', feedPath, categorySlug, skillTagSlug, sort, isGuest, channelId],
    enabled: !authLoading,
    maxPages: MAX_FEED_PAGES,
    refetchOnMount: initialData.data.length === 0 ? 'always' : false,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '12' });
      if (pageParam) params.set('cursor', pageParam as string);
      if (categorySlug) params.set('categorySlug', categorySlug);
      if (skillTagSlug) params.set('skillTagSlugs', skillTagSlug);
      if (channelId && feedPath === '/videos/feed/following') {
        params.set('channelId', channelId);
      }
      const effectiveSort =
        sort ?? (canViewPersonalizedFeed && !categorySlug && !skillTagSlug ? 'forYou' : 'latest');
      if (feedPath !== '/videos/feed/following') {
        params.set('sort', effectiveSort);
      }
      const { data } = await api.get<{ data: PaginatedResponse<Video> }>(`${feedPath}?${params}`);
      return data.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.hasMore ? lastPage.meta.cursor || undefined : undefined,
    initialData: { pages: [initialData], pageParams: [undefined] },
  });

  const atPageCap = (data?.pages.length ?? 0) >= MAX_FEED_PAGES;
  const canLoadMore = hasNextPage && !atPageCap;

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && canLoadMore && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, canLoadMore, isFetchingNextPage]);

  const videos = (data?.pages.flatMap((p) => p.data) ?? []).filter(
    (v) => !hiddenIds.has(v.id) && !mutedChannels.has(v.userId),
  );
  const rows = chunkFeedRows(videos, columnCount);

  useEffect(() => {
    preloadHlsManifests(
      videos.filter((v) => v.status === 'ready').map((v) => v.hlsUrl),
      3,
    );
  }, [videos]);

  useLayoutEffect(() => {
    const update = () => {
      if (listAnchorRef.current) {
        setScrollMargin(listAnchorRef.current.offsetTop);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [videos.length, columnCount]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => estimateFeedRowHeight(columnCount),
    overscan: 4,
    scrollMargin,
    measureElement:
      typeof window !== 'undefined'
        ? (element) => element.getBoundingClientRect().height
        : undefined,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [columnCount, rows.length, virtualizer]);

  if (isError && !videos.length) {
    return (
      <EmptyState
        icon="error"
        title="Couldn't load feed"
        description="Check your connection and try again."
        action={{ label: 'Retry', href: '/' }}
        onAction={() => refetch()}
      />
    );
  }

  if (!videos.length) {
    const isFollowing = feedPath === '/videos/feed/following';
    return (
      <EmptyState
        icon={isFollowing ? 'subscriptions' : 'video_library'}
        title={isFollowing ? 'No videos from subscriptions yet' : 'No videos yet'}
        description={
          categorySlug
            ? 'Nothing in this category right now. Try another filter or check back soon.'
            : isFollowing
              ? 'Subscribe to channels to see their latest uploads here.'
              : 'New videos appear as creators publish. Explore to find something to watch.'
        }
        action={
          isFollowing
            ? { label: 'Go home', href: '/' }
            : { label: 'Explore', href: '/explore' }
        }
      />
    );
  }

  return (
    <div ref={listAnchorRef} data-testid="feed-grid">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowVideos = rows[virtualRow.index];
          if (!rowVideos?.length) return null;
          return (
            <div
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              className="absolute left-0 top-0 w-full px-0"
              style={{
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
            >
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                }}
              >
                {rowVideos.map((video) => (
                  <FeedCard
                    key={video.id}
                    video={video}
                    onNotInterested={(id) => {
                      setHiddenIds((prev) => new Set(prev).add(id));
                    }}
                    onDontRecommendChannel={(channelId) => {
                      setMutedChannels((prev) => new Set(prev).add(channelId));
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={loadMoreRef} className="mt-8 flex min-h-10 flex-col items-center justify-center gap-2">
        {isFetchingNextPage && (
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2 w-2 animate-bounce rounded-full bg-secondary"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}
        {atPageCap && hasNextPage && !isFetchingNextPage && (
          <p className="text-center text-sm text-on-surface-variant">
            Showing the latest {MAX_FEED_PAGES * 12} videos.{' '}
            <a href="/explore" className="text-secondary hover:underline">
              Explore more
            </a>
          </p>
        )}
        {isFetchNextPageError && (
          <button
            type="button"
            onClick={() => fetchNextPage()}
            className="text-sm text-secondary hover:underline"
          >
            Could not load more — tap to retry
          </button>
        )}
      </div>
    </div>
  );
}
