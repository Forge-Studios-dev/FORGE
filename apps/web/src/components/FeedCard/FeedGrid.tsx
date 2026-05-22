'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PaginatedResponse, Video } from '@/types';
import { FeedCard } from './FeedCard';
import { EmptyState } from '@/components/EmptyState';

interface Props {
  initialData: PaginatedResponse<Video>;
  /** Fixed category slug (e.g. explore pages) — overrides ?category= query param */
  categorySlug?: string;
  /** Fixed skill tag slug for /explore/skills/[slug] */
  skillTagSlug?: string;
  /** API path for pagination (default: /videos/feed) */
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
  const { isGuest, isLoading: authLoading, canViewPersonalizedFeed } = useAuth();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError, refetch } = useInfiniteQuery({
    queryKey: ['feed', feedPath, categorySlug, skillTagSlug, sort, isGuest],
    enabled: !authLoading,
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

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const videos = data?.pages.flatMap((p) => p.data) ?? [];

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
    <>
      <div className="forge-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {videos.map((video) => (
          <FeedCard key={video.id} video={video} />
        ))}
      </div>

      <div ref={loadMoreRef} className="h-10 flex items-center justify-center mt-8">
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
      </div>
    </>
  );
}
