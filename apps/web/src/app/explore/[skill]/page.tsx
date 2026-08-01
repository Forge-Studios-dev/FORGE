import { Metadata } from 'next';
import { cache } from 'react';
import { serverApi } from '@/lib/api';

export const revalidate = 120;
import { FeedGrid } from '@/components/FeedCard/FeedGrid';
import { PageHeader } from '@forge/design-system';
import { PaginatedResponse, Video } from '@/types';

interface Props {
  params: { skill: string };
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
  const title = await getCategoryName(params.skill);
  return { title };
}

async function getFeed(skill: string): Promise<PaginatedResponse<Video>> {
  try {
    const { data } = await serverApi.get(
      `/videos/feed?limit=24&categorySlug=${encodeURIComponent(skill)}`,
    );
    return data.data;
  } catch {
    return { data: [], meta: { cursor: null, hasMore: false } };
  }
}

export default async function ExploreSkillPage({ params }: Props) {
  const [feed, title] = await Promise.all([getFeed(params.skill), getCategoryName(params.skill)]);

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <PageHeader title={title} subtitle="Lessons and creators in this discipline" />
      <FeedGrid initialData={feed} categorySlug={params.skill} />
    </main>
  );
}
