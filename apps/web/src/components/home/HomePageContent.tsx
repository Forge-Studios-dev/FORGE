'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Suspense } from 'react';
import { FeedGrid } from '@/components/FeedCard/FeedGrid';
import { FeedGridSkeleton } from '@/components/LoadingSkeleton';
import { CategoryFilter } from '@/components/CategoryFilter';
import { HomeFeedSections } from '@/components/home/HomeFeedSections';
import { LiveNowRail } from '@/components/home/LiveNowRail';
import { HomeHero } from '@/components/home/HomeHero';
import { TrendingSkills } from '@/components/home/TrendingSkills';
import { ContinueWatching } from '@/components/ContinueWatching';
import { VerifyEmailBanner } from '@/components/VerifyEmailBanner';
import { Category, PaginatedResponse, Video } from '@/types';
import { useAuth } from '@/lib/auth';

type Props = {
  feed: PaginatedResponse<Video>;
  trending: PaginatedResponse<Video>;
  categories: Category[];
};

type FeedTab = 'discover' | 'following';

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
  const { canViewPersonalizedFeed } = useAuth();
  const [tab, setTab] = useState<FeedTab>('discover');

  return (
    <main
      data-testid="forge-home"
      className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12"
    >
      <HomeFeedSections />
      <HomeHero />
      <LiveNowRail />
      <ContinueWatching />
      <TrendingSkills videos={trending.data.length > 0 ? trending.data : feed.data} />

      <section id="discover" data-testid="discover-section" className="mt-4">
        <VerifyEmailBanner />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab('discover')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === 'discover'
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Discover
            </button>
            {canViewPersonalizedFeed && (
              <button
                type="button"
                onClick={() => setTab('following')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  tab === 'following'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Following
              </button>
            )}
          </div>
          {tab === 'discover' && (
            <Link href="/explore" className="font-label-caps text-secondary hover:underline">
              View all
            </Link>
          )}
        </div>

        {tab === 'discover' ? (
          <>
            <Suspense fallback={<CategoryFilterSkeleton />}>
              <CategoryFilter categories={categories} />
            </Suspense>
            <Suspense fallback={<FeedSkeleton />}>
              <FeedGrid initialData={feed} />
            </Suspense>
          </>
        ) : (
          <Suspense fallback={<FeedSkeleton />}>
            <FeedGrid
              initialData={{ data: [], meta: { cursor: null, hasMore: false } }}
              feedPath="/videos/feed/following"
            />
          </Suspense>
        )}
      </section>
    </main>
  );
}
