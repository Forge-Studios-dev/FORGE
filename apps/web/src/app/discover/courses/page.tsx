import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@forge/design-system';
import { serverApi } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import { getServerPlatformConfig } from '@/lib/server-platform-config';
import { isCoursesFeatureEnabled } from '@forge/shared-types';
import { CourseCatalogClient, type CatalogCourse } from '@/components/Courses/CourseCatalogClient';

export const revalidate = 3600; // hourly — matches sitemap.ts's ISR window for the same data

export const metadata: Metadata = {
  title: 'Discover courses',
  description: 'Browse published creator courses on FORGE — structured, skill-first learning from real creators.',
  openGraph: {
    title: 'Discover courses on FORGE',
    description: 'Browse published creator courses on FORGE — structured, skill-first learning from real creators.',
    url: `${SITE_URL}/discover/courses`,
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Discover courses on FORGE',
    description: 'Browse published creator courses on FORGE.',
  },
};

async function getFeaturedCourses(): Promise<CatalogCourse[]> {
  try {
    const { data } = await serverApi.get('/courses/discover/featured', { params: { limit: 24 } });
    return data.data ?? [];
  } catch {
    return [];
  }
}

export default async function DiscoverCoursesPage({
  searchParams,
}: {
  searchParams?: { creator?: string };
}) {
  const platformConfig = await getServerPlatformConfig();
  if (!isCoursesFeatureEnabled(platformConfig)) {
    redirect('/explore');
  }

  const featured = await getFeaturedCourses();
  const creatorFilter = searchParams?.creator?.trim() || undefined;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <Link href="/explore" className="mb-4 inline-block text-sm text-primary">
        ← Explore
      </Link>
      <PageHeader
        title={creatorFilter ? `Courses by @${creatorFilter}` : 'Discover courses'}
        subtitle="Find published creator courses on FORGE"
      />

      <CourseCatalogClient initialFeatured={featured} creatorUsername={creatorFilter} />
    </main>
  );
}
