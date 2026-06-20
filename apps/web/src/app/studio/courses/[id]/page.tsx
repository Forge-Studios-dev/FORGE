'use client';

import { useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SubscriptionTier } from '@/types';

type Course = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  isPublished: boolean;
};

type Lesson = {
  id: string;
  title: string;
  slug: string;
  content?: string | null;
  sortOrder: number;
  durationMinutes?: number | null;
};

type TierEntitlement = {
  id: string;
  resourceType: string;
  resourceId?: string | null;
};

export default function StudioCourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('');

  const { data: courses } = useQuery({
    queryKey: ['studio-courses', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: Course[] }>('/creators/me/courses');
      return data.data;
    },
  });

  const course = (courses ?? []).find((c) => c.id === courseId);

  const { data: tiers } = useQuery({
    queryKey: ['my-tiers', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: SubscriptionTier[] }>(`/creators/${user!.id}/tiers`);
      return data.data;
    },
  });

  const tierEntitlementQueries = useQueries({
    queries: (tiers ?? []).map((tier) => ({
      queryKey: ['tier-entitlements', tier.id],
      queryFn: async () => {
        const { data } = await api.get<{ data: TierEntitlement[] }>(
          `/creators/me/tiers/${tier.id}/entitlements`,
        );
        return data.data;
      },
      enabled: !!user?.id && isCreator,
    })),
  });

  const { data: lessons } = useQuery({
    queryKey: ['course-lessons', courseId],
    enabled: !!courseId && !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: Lesson[] }>(`/courses/${courseId}/lessons`);
      return data.data;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (isPublished: boolean) => {
      await api.patch(`/creators/me/courses/${courseId}`, { isPublished });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['studio-courses', user?.id] }),
  });

  const addTierAccessMutation = useMutation({
    mutationFn: async (tierId: string) => {
      await api.post(`/creators/me/tiers/${tierId}/entitlements`, {
        resourceType: 'course',
        resourceId: courseId,
        accessLevel: 'full',
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tier-entitlements'] });
    },
  });

  const removeTierAccessMutation = useMutation({
    mutationFn: async ({ tierId, entitlementId }: { tierId: string; entitlementId: string }) => {
      await api.delete(`/creators/me/tiers/${tierId}/entitlements/${entitlementId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tier-entitlements'] });
    },
  });

  const createLessonMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/creators/me/courses/${courseId}/lessons`, {
        title: lessonTitle.trim(),
        content: lessonContent.trim() || undefined,
        sortOrder: (lessons ?? []).length,
      });
    },
    onSuccess: () => {
      setLessonTitle('');
      setLessonContent('');
      void qc.invalidateQueries({ queryKey: ['course-lessons', courseId] });
    },
  });

  if (!isCreator) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  const tierAccess = (tiers ?? []).map((tier, i) => {
    const entitlements = tierEntitlementQueries[i]?.data ?? [];
    const match = entitlements.find(
      (e) => e.resourceType === 'course' && e.resourceId === courseId,
    );
    return { tier, entitlement: match };
  });

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <Link href="/studio/courses" className="mb-4 inline-block text-sm text-primary">
        ← Back to courses
      </Link>
      <PageHeader
        title={course?.title ?? 'Course'}
        subtitle="Add lessons, publish, and gate access by membership tier"
      />

      <section className="glass-panel mb-8 space-y-3 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-label-caps text-outline">Publish</h2>
            <p className="text-xs text-on-surface-variant">
              {course?.isPublished
                ? 'Published — members with tier access can enroll'
                : 'Draft — only you can preview lessons'}
            </p>
          </div>
          <Button
            variant={course?.isPublished ? 'secondary' : 'primary'}
            disabled={!course || publishMutation.isPending}
            onClick={() => publishMutation.mutate(!course?.isPublished)}
          >
            {course?.isPublished ? 'Unpublish' : 'Publish course'}
          </Button>
        </div>
      </section>

      <section className="glass-panel mb-8 space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">Tier access</h2>
        <p className="text-xs text-on-surface-variant">
          Grant specific tiers access to this course. Members on any active subscription can enroll
          when no course entitlements are configured on their tier.
        </p>
        {(tiers ?? []).length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            <Link href="/studio/tiers" className="text-primary">
              Create membership tiers
            </Link>{' '}
            to gate course access.
          </p>
        ) : (
          <ul className="space-y-2">
            {tierAccess.map(({ tier, entitlement }) => (
              <li
                key={tier.id}
                className="flex items-center justify-between rounded-lg border border-outline-variant/30 px-3 py-2"
              >
                <span className="text-sm">{tier.name}</span>
                {entitlement ? (
                  <Button
                    variant="ghost"
                    className="text-xs"
                    disabled={removeTierAccessMutation.isPending}
                    onClick={() =>
                      removeTierAccessMutation.mutate({
                        tierId: tier.id,
                        entitlementId: entitlement.id,
                      })
                    }
                  >
                    Remove access
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className="text-xs"
                    disabled={addTierAccessMutation.isPending}
                    onClick={() => addTierAccessMutation.mutate(tier.id)}
                  >
                    Grant access
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-panel mb-8 space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">New lesson</h2>
        <Input
          value={lessonTitle}
          onChange={(e) => setLessonTitle(e.target.value)}
          placeholder="Lesson title"
        />
        <textarea
          value={lessonContent}
          onChange={(e) => setLessonContent(e.target.value)}
          placeholder="Lesson content (markdown/text)"
          className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-high px-4 py-3 text-sm"
          rows={5}
        />
        <Button
          disabled={!lessonTitle.trim() || createLessonMutation.isPending}
          onClick={() => createLessonMutation.mutate()}
        >
          Add lesson
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-label-caps text-outline">Lessons ({(lessons ?? []).length})</h2>
        {(lessons ?? []).length === 0 ? (
          <p className="text-sm text-on-surface-variant">No lessons yet.</p>
        ) : (
          <ol className="space-y-2">
            {(lessons ?? []).map((lesson, i) => (
              <li key={lesson.id} className="glass-panel rounded-xl p-4">
                <p className="font-medium">
                  {i + 1}. {lesson.title}
                </p>
                {lesson.content ? (
                  <p className="mt-2 line-clamp-3 text-sm text-on-surface-variant">{lesson.content}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {courseId ? (
          <Link
            href={`/courses/${courseId}`}
            className="inline-block text-sm text-primary underline-offset-2 hover:underline"
          >
            Preview as member →
          </Link>
        ) : null}
      </section>
    </main>
  );
}
