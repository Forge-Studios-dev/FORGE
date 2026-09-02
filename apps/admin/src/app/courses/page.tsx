'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';

type Overview = {
  counts: {
    published: number;
    draft: number;
    programsPublished: number;
  };
  recent: Array<{
    id: string;
    title: string;
    slug: string;
    isPublished: boolean;
    creatorId: string;
    creatorUsername: string | null;
    creatorDisplayName: string | null;
    lessonCount: number;
    updatedAt: string;
    createdAt: string;
  }>;
};

export default function CoursesOversightPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-courses-overview'],
    queryFn: async () => {
      const { data: res } = await api.get<{ data: Overview }>('/admin/courses/overview?limit=50');
      return res.data;
    },
  });

  const counts = data?.counts ?? { published: 0, draft: 0, programsPublished: 0 };
  const recent = data?.recent ?? [];

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 md:px-12">
      <PageHeader
        title="Courses oversight"
        subtitle="Published catalog health across creators"
      />

      <div className="mt-6 flex flex-wrap gap-3">
        {isLoading ? (
          <p className="text-sm text-on-surface-variant" aria-busy="true">
            Loading counts…
          </p>
        ) : (
          <>
            <StatusPill tone="neutral" label={`published: ${counts.published}`} />
            <StatusPill tone="warning" label={`draft: ${counts.draft}`} />
            <StatusPill tone="neutral" label={`programs: ${counts.programsPublished}`} />
          </>
        )}
      </div>

      <h3 className="mt-10 text-sm font-semibold">Recently updated courses</h3>
      {isLoading ? (
        <p className="mt-3 text-sm text-on-surface-variant" aria-busy="true">
          Loading courses…
        </p>
      ) : recent.length === 0 ? (
        <p className="mt-3 text-sm text-on-surface-variant">No courses yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {recent.map((course) => (
            <li
              key={course.id}
              className="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{course.title}</p>
                <StatusPill
                  tone={course.isPublished ? 'neutral' : 'warning'}
                  label={course.isPublished ? 'Published' : 'Draft'}
                />
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">
                {course.creatorDisplayName || course.creatorUsername || course.creatorId.slice(0, 8)}
                {course.creatorUsername ? ` (@${course.creatorUsername})` : ''} · {course.lessonCount}{' '}
                lesson{course.lessonCount === 1 ? '' : 's'} · updated{' '}
                {new Date(course.updatedAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
