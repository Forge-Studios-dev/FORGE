import { Metadata } from 'next';
import Link from 'next/link';
import { serverApi } from '@/lib/api';
import { PageHeader, FeedGridSkeleton } from '@forge/design-system';
import { FeedCard } from '@/components/FeedCard/FeedCard';
import { Video } from '@/types';

export const metadata: Metadata = {
  title: 'Trending',
  description: 'Videos trending on FORGE right now',
};

export const revalidate = 120;

async function getTrending(): Promise<Video[]> {
  try {
    const { data } = await serverApi.get('/videos/feed/trending?limit=24');
    const payload = data.data;
    if (Array.isArray(payload?.data)) return payload.data as Video[];
    if (Array.isArray(payload)) return payload as Video[];
    return [];
  } catch {
    try {
      const { data } = await serverApi.get('/videos/trending?limit=24');
      const payload = data.data;
      if (Array.isArray(payload?.data)) return payload.data as Video[];
      if (Array.isArray(payload)) return payload as Video[];
      return [];
    } catch {
      return [];
    }
  }
}

export default async function TrendingPage() {
  const videos = await getTrending();

  return (
    <main
      data-testid="forge-trending"
      className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Trending" subtitle="What people are watching now" />
        <Link href="/explore" className="text-sm text-primary hover:underline">
          Explore categories
        </Link>
      </div>

      {videos.length === 0 ? (
        <div className="space-y-4">
          <p className="text-on-surface-variant">No trending videos yet — check back soon.</p>
          <FeedGridSkeleton count={8} />
        </div>
      ) : (
        <div className="forge-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((video) => (
            <FeedCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </main>
  );
}
