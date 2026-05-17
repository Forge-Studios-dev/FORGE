'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { FeedCard } from '@/components/FeedCard/FeedCard';
import { Video } from '@/types';

type Props = {
  videos: Video[];
};

/** Horizontal trending row for guests — matches Stitch home blueprint */
export function TrendingSkills({ videos }: Props) {
  const { isGuest } = useAuth();

  if (!isGuest || videos.length === 0) return null;

  return (
    <section className="mb-12 forge-fade-in">
      <h2 className="font-display-forge mb-6 text-2xl font-semibold md:text-3xl">Trending skills</h2>
      <div className="hide-scrollbar -mx-5 flex gap-6 overflow-x-auto px-5 md:mx-0 md:px-0">
        {videos.slice(0, 6).map((video) => (
          <FeedCard key={video.id} video={video} compact />
        ))}
      </div>
    </section>
  );
}
