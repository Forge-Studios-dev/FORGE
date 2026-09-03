import { Metadata } from 'next';
import { cache } from 'react';
import { serverApi } from '@/lib/api';

export const revalidate = 120;
import { FeedGrid } from '@/components/FeedCard/FeedGrid';
import { PageHeader } from '@forge/design-system';
import { PaginatedResponse, Video } from '@/types';

interface Props {
  params: { category: string };
}

const getCategoryName = cache(async (slug: string): Promise<string> => {
  try {
    const { data } = await serverApi.get<{ data: { name: string; slug: string }[] }>('/categories');
    const match = data.data?.find((c) => c.slug === slug);
    return match?.name ?? slug.replace(/-/g, ' ');
  } catch {
    return slug.replace(/-/g, ' ');
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const title = await getCategoryName(params.category);
  return {
    title,
    description: `Watch ${title} videos from FORGE creators — skill-first learning with YouTube-style discovery.`,
  };
}

async function getFeed(category: string): Promise<PaginatedResponse<Video>> {
  try {
    const { data } = await serverApi.get(
      `/videos/feed?limit=24&categorySlug=${encodeURIComponent(category)}`,
    );
    return data.data;
  } catch {
    return { data: [], meta: { cursor: null, hasMore: false } };
  }
}

export default async function ExploreCategoryPage({ params }: Props) {
  const [feed, title] = await Promise.all([
    getFeed(params.category),
    getCategoryName(params.category),
  ]);

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <PageHeader title={title} subtitle="Videos and channels in this category" />
      <FeedGrid initialData={feed} categorySlug={params.category} />
    </main>
  );
}
