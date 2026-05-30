'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { FeedGrid } from '@/components/FeedCard/FeedGrid';
import { FeedGridSkeleton } from '@/components/LoadingSkeleton';
import { CategoryFilter } from '@/components/CategoryFilter';
import { HomeFeedSections } from '@/components/home/HomeFeedSections';
import { HomeHero } from '@/components/home/HomeHero';
import { TrendingSkills } from '@/components/home/TrendingSkills';
import { ContinueWatching } from '@/components/ContinueWatching';
import { VerifyEmailBanner } from '@/components/VerifyEmailBanner';
import { Category, PaginatedResponse, Video } from '@/types';

type Props = {
  feed: PaginatedResponse<Video>;
  trending: PaginatedResponse<Video>;
  categories: Category[];
};

function CategoryFilterSkeleton() {
  return (
    <div className="mb-8 flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-9 w-28 shrink-0 forge-shimmer rounded-full" />
      ))}
    </div>
  );
}

function FeedSkeleton() {
  return <FeedGridSkeleton count={8} />;
}

export function HomePageContent({ feed, trending, categories }: Props) {
  return (
    <main
      data-testid="forge-home"
      className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12"
    >
      <HomeFeedSections />
      <HomeHero />
      <ContinueWatching />
      <TrendingSkills videos={trending.data.length > 0 ? trending.data : feed.data} />

      <section id="discover" data-testid="discover-section" className="mt-4">
        <VerifyEmailBanner />
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-display-forge text-2xl font-semibold md:text-3xl">Discover lessons</h2>
          <Link href="/explore" className="font-label-caps text-secondary hover:underline">
            View all
          </Link>
        </div>

        <Suspense fallback={<CategoryFilterSkeleton />}>
          <CategoryFilter categories={categories} />
        </Suspense>

        <Suspense fallback={<FeedSkeleton />}>
          <FeedGrid initialData={feed} />
        </Suspense>
      </section>
    </main>
  );
}
