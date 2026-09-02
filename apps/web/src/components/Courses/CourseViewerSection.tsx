'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CourseViewerClient } from './CourseViewerClient';

type SyllabusLesson = {
  id: string;
  title: string;
  lessonType?: string;
  durationMinutes?: number | null;
};

/** Guest syllabus + sign-in CTA; enrolled viewers get the full client viewer. */
export function CourseViewerSection({ courseId }: { courseId: string }) {
  const { isGuest } = useAuth();

  const { data: syllabus, isLoading } = useQuery({
    queryKey: ['course-syllabus', courseId],
    enabled: isGuest && !!courseId,
    queryFn: async () => {
      const { data } = await api.get<{ data: SyllabusLesson[] }>(
        `/courses/${courseId}/catalog/lessons`,
      );
      return data.data ?? [];
    },
  });

  if (!isGuest) {
    return <CourseViewerClient courseId={courseId} />;
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-on-surface-variant">
        <Link href={`/login?next=/courses/${courseId}`} className="text-primary">
          Sign in
        </Link>{' '}
        to enroll and access full lesson content.
      </p>
      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading syllabus…</p>
      ) : (syllabus ?? []).length === 0 ? (
        <p className="text-sm text-on-surface-variant">Lessons coming soon.</p>
      ) : (
        <ol className="space-y-2">
          {(syllabus ?? []).map((lesson, i) => (
            <li
              key={lesson.id}
              className="flex items-center justify-between rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm"
            >
              <span>
                {i + 1}. {lesson.title}
              </span>
              <span className="text-xs text-on-surface-variant">
                {lesson.lessonType === 'video' ? 'Video' : 'Text'}
                {lesson.durationMinutes ? ` · ${lesson.durationMinutes} min` : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
