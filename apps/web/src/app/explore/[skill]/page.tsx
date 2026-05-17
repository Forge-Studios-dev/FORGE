import { Metadata } from 'next';
import { serverApi } from '@/lib/api';
import { FeedGrid } from '@/components/FeedCard/FeedGrid';
import { PageHeader } from '@forge/design-system';
import { PaginatedResponse, Video } from '@/types';

const LABELS: Record<string, string> = {
  'physical-crafts': 'Physical Crafts',
  'art-design': 'Art & Design',
  'building-tech': 'Building & Tech',
  fitness: 'Fitness & Transformation',
  'learning-journeys': 'Learning Journeys',
  music: 'Music & Practice',
};

interface Props {
  params: { skill: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: LABELS[params.skill] ?? 'Explore' };
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
  const feed = await getFeed(params.skill);
  const title = LABELS[params.skill] ?? params.skill.replace(/-/g, ' ');

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <PageHeader title={title} subtitle="Lessons and creators in this discipline" />
      <FeedGrid initialData={feed} />
    </main>
  );
}
