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

type TrendingWindow = 'now' | 'week';

async function getTrending(window: TrendingWindow): Promise<Video[]> {
  const qs = `limit=24&window=${window}`;
  try {
    const { data } = await serverApi.get(`/videos/trending?${qs}`);
    const payload = data.data;
    if (Array.isArray(payload?.data)) return payload.data as Video[];
    if (Array.isArray(payload)) return payload as Video[];
    return [];
  } catch {
    try {
      const { data } = await serverApi.get(`/videos/feed/trending?limit=24`);
      const payload = data.data;
      if (Array.isArray(payload?.data)) return payload.data as Video[];
      if (Array.isArray(payload)) return payload as Video[];
      return [];
    } catch {
      return [];
    }
  }
}

function WindowTabs({ active }: { active: TrendingWindow }) {
  const tabs: Array<{ id: TrendingWindow; label: string }> = [
    { id: 'now', label: 'Now' },
    { id: 'week', label: 'This week' },
  ];
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Trending time window">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.id === 'week' ? '/trending' : `/trending?window=${tab.id}`}
            role="tab"
            aria-selected={selected}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              selected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-outline-variant/40 text-on-surface-variant hover:border-primary'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export default async function TrendingPage({
  searchParams,
}: {
  searchParams?: Promise<{ window?: string }> | { window?: string };
}) {
  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  const raw = (params?.window ?? 'week').toLowerCase();
  const window: TrendingWindow = raw === 'now' || raw === '24h' ? 'now' : 'week';
  const videos = await getTrending(window);

  return (
    <main
      data-testid="forge-trending"
      className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Trending"
          subtitle={
            window === 'now' ? 'Hottest in the last 24 hours' : 'What people are watching this week'
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          <WindowTabs active={window} />
          <Link href="/explore" className="text-sm text-primary hover:underline">
            Explore categories
          </Link>
        </div>
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
