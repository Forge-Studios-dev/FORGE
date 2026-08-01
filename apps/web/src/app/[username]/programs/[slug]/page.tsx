'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { Button, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isValidProfileUsername } from '@/lib/username';

type ProgramCourse = {
  courseId: string;
  sortOrder: number;
  course?: { id: string; title: string; slug: string; isPublished: boolean } | null;
};

type Program = {
  id: string;
  creatorId: string;
  name: string;
  slug: string;
  description?: string | null;
  communityId?: string | null;
  courses: ProgramCourse[];
};

export default function ProgramViewerPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const slug = params.slug as string;
  const { user, isGuest } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile-by-username', username],
    enabled: isValidProfileUsername(username),
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: string; displayName: string; username: string } }>(
        `/users/by-username/${username}`,
      );
      return data.data;
    },
  });

  const creatorId = profile?.id;

  const { data: program, isLoading, error } = useQuery({
    queryKey: ['program-detail', creatorId, slug],
    enabled: !!creatorId && !!slug,
    queryFn: async () => {
      const { data } = await api.get<{ data: Program }>(
        `/creators/${creatorId}/programs/${slug}`,
      );
      return data.data;
    },
    retry: false,
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!program) return;
      await api.post(`/programs/${program.id}/enroll`, {});
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['program-detail', creatorId, slug] });
      if (program?.courses[0]?.courseId) {
        router.push(`/courses/${program.courses[0].courseId}`);
      }
    },
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-on-surface-variant">Loading program…</p>
      </main>
    );
  }

  if (error || !program) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <PageHeader title="Program not found" />
        <Link href={`/${username}`} className="text-primary text-sm">
          ← Back to profile
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <PageHeader
        title={program.name}
        subtitle={profile ? `by ${profile.displayName}` : undefined}
      />

      {program.description ? (
        <p className="mb-6 text-on-surface-variant">{program.description}</p>
      ) : null}

      <section className="mb-8">
        <h2 className="font-label-caps text-outline mb-3">Courses in this program</h2>
        <ol className="space-y-2">
          {program.courses.map((row, index) => (
            <li
              key={row.courseId}
              className="flex items-center justify-between rounded-lg bg-surface-container-high px-4 py-3"
            >
              <span className="text-sm">
                <span className="text-on-surface-variant mr-2">{index + 1}.</span>
                {row.course?.title ?? 'Course'}
              </span>
              {row.course?.id ? (
                <Link href={`/courses/${row.course.id}`} className="text-primary text-sm">
                  Open
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {isGuest ? (
        <p className="text-sm text-on-surface-variant">
          <Link href="/login" className="text-primary">
            Sign in
          </Link>{' '}
          to enroll in this program.
        </p>
      ) : (
        <Button
          disabled={enrollMutation.isPending || program.courses.length === 0}
          onClick={() => enrollMutation.mutate()}
        >
          {enrollMutation.isPending ? 'Enrolling…' : 'Enroll in program'}
        </Button>
      )}

      <div className="mt-8">
        <Link href={`/${username}`} className="text-primary text-sm">
          ← Back to profile
        </Link>
      </div>
    </main>
  );
}
