import Link from 'next/link';
import { serverApi } from '@/lib/api';
import { getServerPlatformConfig } from '@/lib/server-platform-config';
import { isCoursesFeatureEnabled } from '@forge/shared-types';
import type { CatalogCourse } from './CourseCatalogClient';

async function getFeaturedCourses(): Promise<CatalogCourse[]> {
  try {
    const { data } = await serverApi.get('/courses/discover/featured', { params: { limit: 6 } });
    return data.data ?? [];
  } catch {
    return [];
  }
}

/** Home / discovery rail — server-rendered when courses flag is on. */
export async function FeaturedCoursesRail() {
  const config = await getServerPlatformConfig();
  if (!isCoursesFeatureEnabled(config)) return null;

  const courses = await getFeaturedCourses();
  if (courses.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display-forge text-xl font-semibold">Courses for you</h2>
        <Link href="/discover/courses" className="text-sm text-primary hover:underline">
          Browse all
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <li key={course.id}>
            <Link
              href={`/courses/${course.id}`}
              className="forge-card-hover block h-full rounded-xl border border-outline-variant/30 bg-surface-container p-5 transition-colors hover:border-primary/40"
            >
              <h3 className="font-semibold text-on-surface">{course.title}</h3>
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
  );
}
