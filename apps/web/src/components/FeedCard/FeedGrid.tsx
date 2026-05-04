'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { PaginatedResponse, Video } from '@/types';
import { FeedCard } from './FeedCard';

interface Props {
  initialData: PaginatedResponse<Video>;
}

export function FeedGrid({ initialData }: Props) {
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get('category');
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['feed', categorySlug],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '12' });
      if (pageParam) params.set('cursor', pageParam as string);
      if (categorySlug) params.set('categorySlug', categorySlug);
      const { data } = await api.get<{ data: PaginatedResponse<Video> }>(`/videos/feed?${params}`);
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

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                className="w-2 h-2 rounded-full bg-forge-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
