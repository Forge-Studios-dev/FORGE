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

interface Props {
  creatorId: string;
  username: string;
}

export function CreatorCoursesPanel({ creatorId, username }: Props) {
  const { data: courses, isLoading } = useQuery({
    queryKey: ['creator-courses-catalog', creatorId],
    queryFn: async () => {
      const { data } = await api.get<{ data: CatalogCourse[] }>(`/creators/${creatorId}/courses`);
      return data.data ?? [];
    },
  });

  if (isLoading) return null;
  if (!courses?.length) return null;

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-6">
      <h2 className="text-xl font-bold mb-4">Courses</h2>
      <p className="text-sm text-on-surface-variant mb-4">
        Structured lessons from this creator.
      </p>
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
    </section>
  );
}
