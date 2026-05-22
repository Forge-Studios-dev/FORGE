import { Metadata } from 'next';
import { serverApi } from '@/lib/api';
import { FeedGrid } from '@/components/FeedCard/FeedGrid';
import { PageHeader } from '@forge/design-system';
import { PaginatedResponse, Video } from '@/types';

interface Props {
  params: { slug: string };
}

async function getFeed(slug: string): Promise<PaginatedResponse<Video>> {
  try {
    const { data } = await serverApi.get(
      `/videos/by-skills?limit=24&skillTagSlugs=${encodeURIComponent(slug)}`,
    );
    return data.data;
  } catch {
    return { data: [], meta: { cursor: null, hasMore: false } };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const title = params.slug.replace(/-/g, ' ');
  return { title: `${title} lessons` };
}

export default async function ExploreSkillTagPage({ params }: Props) {
  const feed = await getFeed(params.slug);
  const title = params.slug.replace(/-/g, ' ');

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <PageHeader title={title} subtitle="Lessons tagged with this skill" />
      <FeedGrid initialData={feed} skillTagSlug={params.slug} feedPath="/videos/by-skills" />
    </main>
  );
}
