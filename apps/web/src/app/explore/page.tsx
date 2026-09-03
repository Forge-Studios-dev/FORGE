import Link from 'next/link';
import { Metadata } from 'next';
import { serverApi } from '@/lib/api';
import { Icon, PageHeader } from '@forge/design-system';
import { getServerPlatformConfig } from '@/lib/server-platform-config';
import { isCoursesFeatureEnabled } from '@forge/shared-types';
import { Category } from '@/types';
import type { CatalogCourse } from '@/components/Courses/CourseCatalogClient';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Browse skill categories and discover creators teaching on FORGE.',
};

export const revalidate = 300;

async function getCategories(): Promise<Category[]> {
  try {
    const { data } = await serverApi.get('/categories');
    return data.data;
  } catch {
    return [];
  }
}

async function getFeaturedCourses(): Promise<CatalogCourse[]> {
  try {
    const { data } = await serverApi.get('/courses/discover/featured', { params: { limit: 8 } });
    return data.data ?? [];
  } catch {
    return [];
  }
}

async function getSkillTopics(): Promise<Array<{ name: string; slug: string; categorySlug: string }>> {
  try {
    const { data } = await serverApi.get('/categories/upload-options');
    const categories: Array<{
      slug: string;
      skillTags?: Array<{ name: string; slug: string }>;
    }> = Array.isArray(data.data) ? data.data : [];
    const topics: Array<{ name: string; slug: string; categorySlug: string }> = [];
    for (const cat of categories) {
      for (const tag of cat.skillTags ?? []) {
        if (tag.slug && tag.name) {
          topics.push({ name: tag.name, slug: tag.slug, categorySlug: cat.slug });
        }
      }
    }
    return topics.slice(0, 24);
  } catch {
    return [];
  }
}

export default async function ExplorePage() {
  const [categories, platformConfig, skillTopics] = await Promise.all([
    getCategories(),
    getServerPlatformConfig(),
    getSkillTopics(),
  ]);
  const coursesEnabled = isCoursesFeatureEnabled(platformConfig);
  const featuredCourses = coursesEnabled ? await getFeaturedCourses() : [];

  return (
    <main
      data-testid="forge-explore"
      className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12"
    >
      <PageHeader title="Explore" subtitle="Browse categories and discover creators" />

      <div className="mb-8 flex flex-wrap gap-3">
        <Link href="/trending" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:bg-surface-container-high">
          Trending
        </Link>
        <Link href="/search" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:bg-surface-container-high">
          Search
        </Link>
        <Link href="/shorts" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:bg-surface-container-high">
          Shorts
        </Link>
        <Link href="/live" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:bg-surface-container-high">
          Live
        </Link>
        {coursesEnabled ? (
          <Link href="/discover/courses" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:bg-surface-container-high">
            Courses
          </Link>
        ) : null}
      </div>

      {featuredCourses.length > 0 ? (
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-label-caps text-on-surface-variant">Featured courses</h2>
            <Link href="/discover/courses" className="text-sm text-primary">
              See all
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredCourses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/courses/${course.id}`}
                  className="forge-card-hover block rounded-xl border border-outline-variant/30 bg-surface-container p-5 transition-colors hover:border-primary/40"
                >
                  <h3 className="font-display-forge text-lg font-semibold text-on-surface">{course.title}</h3>
                  {course.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">{course.description}</p>
                  ) : null}
                  <p className="mt-3 text-xs text-on-surface-variant">
                    {course.lessonCount} lesson{course.lessonCount === 1 ? '' : 's'}
                    {course.creator ? ` · ${course.creator.displayName}` : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {skillTopics.length > 0 ? (
        <section className="mb-12">
          <h2 className="font-label-caps mb-4 text-on-surface-variant">Popular skills</h2>
          <div className="flex flex-wrap gap-2">
            {skillTopics.map((topic) => (
              <Link
                key={`${topic.categorySlug}-${topic.slug}`}
                href={`/search?q=${encodeURIComponent(topic.name)}`}
                className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:bg-surface-container-high"
              >
                {topic.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-12">
        <h2 className="font-label-caps mb-4 text-on-surface-variant">Browse by category</h2>
        {categories.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/explore/${cat.slug}`}
                className="forge-card-hover group rounded-xl border border-outline-variant/30 bg-surface-container p-6 transition-colors hover:border-primary/40"
              >
                <Icon name="category" className="mb-3 text-3xl text-primary" />
                <h3 className="font-display-forge text-lg font-semibold text-on-surface group-hover:text-primary">
                  {cat.name}
                </h3>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-on-surface-variant">Categories are loading — check back shortly.</p>
        )}
      </section>

    </main>
  );
}
