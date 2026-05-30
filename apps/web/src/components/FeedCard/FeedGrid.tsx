'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFeedScrollRestore } from '@/lib/use-feed-scroll-restore';
import { chunkFeedRows, useFeedColumns } from '@/lib/use-feed-columns';
import { PaginatedResponse, Video } from '@/types';
import { FeedCard } from './FeedCard';
import { EmptyState } from '@/components/EmptyState';

/** With row virtualization, allow more cached pages; DOM stays bounded. */
const MAX_FEED_PAGES = 10;
const FEED_ROW_ESTIMATE_PX = 300;

interface Props {
  initialData: PaginatedResponse<Video>;
  categorySlug?: string;
  skillTagSlug?: string;
  feedPath?: string;
  sort?: 'latest' | 'popular' | 'forYou';
}

export function FeedGrid({
  initialData,
  categorySlug: categorySlugProp,
  skillTagSlug,
  feedPath = '/videos/feed',
  sort,
}: Props) {
  const searchParams = useSearchParams();
  const categorySlug = categorySlugProp ?? searchParams.get('category') ?? undefined;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const listAnchorRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
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
    queryKey: ['feed', feedPath, categorySlug, skillTagSlug, sort, isGuest],
    enabled: !authLoading,
    maxPages: MAX_FEED_PAGES,
    refetchOnMount: false,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '12' });
      if (pageParam) params.set('cursor', pageParam as string);
      if (categorySlug) params.set('categorySlug', categorySlug);
      if (skillTagSlug) params.set('skillTagSlugs', skillTagSlug);
      const effectiveSort =
        sort ?? (canViewPersonalizedFeed && !categorySlug && !skillTagSlug ? 'forYou' : 'latest');
      params.set('sort', effectiveSort);
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

  const videos = data?.pages.flatMap((p) => p.data) ?? [];
  const rows = chunkFeedRows(videos, columnCount);

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
    estimateSize: () => FEED_ROW_ESTIMATE_PX,
    overscan: 4,
    scrollMargin,
  });

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
    return (
      <EmptyState
        icon="video_library"
        title="No lessons yet"
        description={
          categorySlug
            ? 'Nothing in this category right now. Try another skill or check back soon.'
            : 'New tutorials appear as creators publish. Explore skills to get started.'
        }
        action={{ label: 'Explore skills', href: '/explore' }}
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
              className="absolute left-0 top-0 w-full px-0"
              style={{
                height: `${virtualRow.size}px`,
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
                  <FeedCard key={video.id} video={video} />
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
            Showing the latest {MAX_FEED_PAGES * 12} lessons.{' '}
            <a href="/explore" className="text-secondary hover:underline">
              Explore more skills
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
