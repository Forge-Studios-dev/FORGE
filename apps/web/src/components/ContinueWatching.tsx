'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Video } from '@/types';
import { FeedCard } from '@/components/FeedCard/FeedCard';
import { HorizontalCardSkeleton } from '@/components/LoadingSkeleton';

export function ContinueWatching() {
  const { user, isGuest, isLoading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['watch-history', 'continue', user?.id],
    enabled: !authLoading && !isGuest && !!user,
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: Video[] } }>('/users/me/watch-history?incomplete=true&limit=8');
      return data.data.data;
    },
  });

  if (!user) return null;
  if (isLoading) {
    return (
      <section className="mb-10">
        <h2 className="font-display-forge mb-6 text-2xl font-semibold md:text-3xl">Continue mastering</h2>
        <HorizontalCardSkeleton count={4} />
      </section>
    );
  }
  if (!data?.length) return null;

  return (
    <section id="continue" className="mb-12">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display-forge text-2xl font-semibold md:text-3xl">Continue mastering</h2>
        <Link href="/history" className="font-label-caps text-secondary hover:underline">
          All history
        </Link>
      </div>
      <div className="hide-scrollbar -mx-5 flex gap-6 overflow-x-auto px-5 md:mx-0 md:px-0">
        {data.map((video) => (
          <FeedCard key={video.id} video={video} layout="carousel" />
        ))}
      </div>
    </section>
  );
}
