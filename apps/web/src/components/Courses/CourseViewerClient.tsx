'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, PaywallCard } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAccessSession } from '@/lib/access-session';

type Lesson = {
  id: string;
  title: string;
  slug: string;
  content?: string | null;
  sortOrder: number;
};

type Progress = {
  lessonsTotal: number;
  lessonsCompleted: number;
  progress: number;
};

/**
 * Auth-gated lesson viewer/enrollment UI for a course. The page shell
 * (title, description, metadata, JSON-LD) is server-rendered by the parent
 * page for SEO — this component owns only the interactive, per-viewer part
 * (enrollment state, lesson access, progress) which genuinely needs a client
 * session and can't be crawled anyway.
 */
export function CourseViewerClient({ courseId }: { courseId: string }) {
  const { isGuest } = useAuth();
  const qc = useQueryClient();

  const { data: lessons, isLoading, error } = useQuery({
    queryKey: ['course-lessons-view', courseId],
    enabled: !!courseId && !isGuest,
    queryFn: async () => {
      const { data } = await api.get<{ data: Lesson[] }>(`/courses/${courseId}/lessons`);
      return data.data;
    },
    retry: false,
  });

  const { data: progress } = useQuery({
    queryKey: ['course-progress', courseId],
    enabled: !!courseId && !isGuest && !!lessons?.length,
    queryFn: async () => {
      const { data } = await api.get<{ data: Progress }>(`/courses/${courseId}/progress`);
      return data.data;
    },
    retry: false,
  });

  const { ready, conflict, takeOver } = useAccessSession(
    'course',
    courseId,
    !isGuest && !!lessons?.length,
  );

  const enrollMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/courses/${courseId}/enroll`, {});
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['course-lessons-view', courseId] });
      void qc.invalidateQueries({ queryKey: ['course-progress', courseId] });
    },
  });

  const progressMutation = useMutation({
    mutationFn: async ({ lessonId, percent }: { lessonId: string; percent: number }) => {
      await api.post(`/courses/${courseId}/lessons/${lessonId}/progress`, {
        progressPercent: percent,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['course-progress', courseId] });
    },
  });

  if (isGuest) {
    return (
      <p className="text-sm text-on-surface-variant">
        <Link href={`/login?next=/courses/${courseId}`} className="text-primary">
          Sign in
        </Link>{' '}
        to access this course.
      </p>
    );
  }

  const errorStatus =
    error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;
  const accessDenied = errorStatus === 403;

  if (errorStatus === 404) notFound();

  return (
    <>
      {accessDenied ? (
        <PaywallCard
          title="Course access restricted"
          message="You need membership access to view this course."
          aspectVideo={false}
        >
          <Button disabled={enrollMutation.isPending} onClick={() => enrollMutation.mutate()}>
            Enroll (requires membership)
          </Button>
        </PaywallCard>
      ) : isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : (
        <>
          {progress ? (
            <div className="glass-panel mb-6 rounded-xl p-4">
              <p className="text-sm font-medium">Progress: {progress.progress}%</p>
              <p className="text-xs text-on-surface-variant">
                {progress.lessonsCompleted} / {progress.lessonsTotal} lessons complete
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <Button
                variant="secondary"
                disabled={enrollMutation.isPending}
                onClick={() => enrollMutation.mutate()}
              >
                Enroll in course
              </Button>
            </div>
          )}

          {conflict ? (
            <div className="glass-panel mb-4 rounded-xl p-4 text-sm">
              <p className="text-on-surface-variant">{conflict}</p>
              <Button className="mt-2" variant="secondary" onClick={takeOver}>
                Take over session
              </Button>
            </div>
          ) : null}

          {!ready && lessons?.length ? (
            <p className="mb-4 text-sm text-on-surface-variant">Starting secure viewing session…</p>
          ) : null}

          <ol className="space-y-4">
            {(lessons ?? []).map((lesson, i) => (
              <li key={lesson.id} className="glass-panel rounded-xl p-5">
                <h3 className="font-semibold">
                  {i + 1}. {lesson.title}
                </h3>
                {lesson.content ? (
                  <div className="prose prose-invert mt-3 max-w-none text-sm whitespace-pre-wrap">
                    {lesson.content}
                  </div>
                ) : null}
                <Button
                  className="mt-4"
                  variant="secondary"
                  disabled={progressMutation.isPending}
                  onClick={() => progressMutation.mutate({ lessonId: lesson.id, percent: 100 })}
                >
                  Mark complete
                </Button>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
