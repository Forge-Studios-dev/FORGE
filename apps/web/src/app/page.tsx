import { Suspense } from 'react';
import { Metadata } from 'next';
import { serverApi } from '@/lib/api';
import { FeedGrid } from '@/components/FeedCard/FeedGrid';
import { CategoryFilter } from '@/components/CategoryFilter';
import { HeroSection } from '@/components/HeroSection';
import { Category, PaginatedResponse, Video } from '@/types';

export const metadata: Metadata = {
  title: 'FORGE – Learn from Creators',
  description: 'Discover skill-based tutorials and live sessions from expert creators.',
};

async function getInitialFeed(): Promise<PaginatedResponse<Video>> {
  try {
    const { data } = await serverApi.get('/videos/feed?limit=12');
    return data.data;
  } catch {
    return { data: [], meta: { cursor: null, hasMore: false } };
  }
}

async function getCategories(): Promise<Category[]> {
  try {
    const { data } = await serverApi.get('/categories');
    return data.data;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [feed, categories] = await Promise.all([getInitialFeed(), getCategories()]);

  return (
    <main className="min-h-screen">
      <HeroSection />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Discover Skills</h2>
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

function CategoryFilterSkeleton() {
  return (
    <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-9 w-28 bg-white/5 rounded-full animate-pulse shrink-0" />
      ))}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-surface-card rounded-xl overflow-hidden animate-pulse">
          <div className="aspect-video bg-white/5" />
          <div className="p-3 space-y-2">
            <div className="h-4 bg-white/5 rounded w-3/4" />
            <div className="h-3 bg-white/5 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
