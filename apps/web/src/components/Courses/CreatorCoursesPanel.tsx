'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@forge/design-system';
import { api } from '@/lib/api';

type CatalogCourse = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  lessonCount: number;
  creator?: { id: string; username: string; displayName: string } | null;
};

type ProgramCourse = {
  courseId: string;
  course?: { id: string; title: string; slug: string; isPublished: boolean } | null;
};

type Program = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  courses: ProgramCourse[];
};

interface Props {
  creatorId: string;
  username: string;
}

/**
 * One "Courses" panel covering both individual courses and programs (a
 * program is a course-row bundle grouping several courses — see
 * apps/api/.../1839800000000-merge-programs-into-courses.ts) instead of two
 * separately-titled profile sections for what a visitor experiences as one
 * concept: "what can I learn from this creator."
 */
export function CreatorCoursesPanel({ creatorId, username }: Props) {
  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['creator-courses-catalog', creatorId],
    queryFn: async () => {
      const { data } = await api.get<{ data: CatalogCourse[] }>(`/creators/${creatorId}/courses`);
      return data.data ?? [];
    },
  });

  const { data: programs, isLoading: programsLoading } = useQuery({
    queryKey: ['creator-programs', creatorId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Program[] }>(`/creators/${creatorId}/programs`);
      return data.data ?? [];
    },
  });

  if (coursesLoading || programsLoading) return null;
  if (!courses?.length && !programs?.length) return null;

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-6">
      <h2 className="text-xl font-bold mb-4">Courses</h2>

      {courses?.length ? (
        <>
          <p className="text-sm text-on-surface-variant mb-4">Structured lessons from this creator.</p>
          <ul className="space-y-3">
            {courses.map((course) => (
              <li
                key={course.id}
                className="flex flex-col gap-2 rounded-lg bg-surface-container p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{course.title}</p>
                  {course.description ? (
                    <p className="text-sm text-on-surface-variant line-clamp-2">{course.description}</p>
                  ) : null}
                  <p className="text-xs text-on-surface-variant mt-1">
                    {course.lessonCount} lesson{course.lessonCount === 1 ? '' : 's'}
                  </p>
                </div>
                <Link href={`/courses/${course.id}`}>
                  <Button variant="outline" className="text-sm">
                    View course
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-on-surface-variant">
            <Link href={`/discover/courses?creator=${username}`} className="text-primary">
              Browse all courses
            </Link>
          </p>
        </>
      ) : null}

      {programs?.length ? (
        <div className={courses?.length ? 'mt-8 border-t border-outline-variant/20 pt-6' : ''}>
          <h3 className="font-label-caps mb-1 text-outline">Programs</h3>
          <p className="text-sm text-on-surface-variant mb-4">
            Multi-course paths curated by this creator.
          </p>
          <ul className="space-y-3">
            {programs.map((program) => (
              <li
                key={program.id}
                className="flex flex-col gap-2 rounded-lg bg-surface-container p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{program.name}</p>
                  {program.description ? (
                    <p className="text-sm text-on-surface-variant line-clamp-2">{program.description}</p>
                  ) : null}
                  <p className="text-xs text-on-surface-variant mt-1">
                    {program.courses.length} course{program.courses.length === 1 ? '' : 's'}
                  </p>
                </div>
                <Link href={`/${username}/programs/${program.slug}`}>
                  <Button variant="outline" className="text-sm">
                    View program
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
