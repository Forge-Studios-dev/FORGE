'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button, Input, PageHeader } from '@forge/design-system';
import { Tabs, TabPanel } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Course = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  isPublished: boolean;
  createdAt: string;
};

type ProgramCourse = {
  id: string;
  courseId: string;
  course?: { id: string; title: string; slug: string; isPublished: boolean } | null;
};

type Program = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  communityId?: string | null;
  isPublished: boolean;
  courses: ProgramCourse[];
};

export default function StudioCoursesPage() {
  return (
    <Suspense fallback={null}>
      <StudioCoursesPageInner />
    </Suspense>
  );
}

function StudioCoursesPageInner() {
  const { user, isCreator } = useAuth();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'programs' ? 'programs' : 'courses');

  if (!isCreator) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <PageHeader
        title="Courses"
        subtitle="Structured lessons, plus programs that group several courses into one paid path"
      />

      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'courses', label: 'Courses' },
          { id: 'programs', label: 'Programs' },
        ]}
      />

      <TabPanel id="courses" value={tab}>
        <CoursesTab userId={user?.id} />
      </TabPanel>
      <TabPanel id="programs" value={tab}>
        <ProgramsTab userId={user?.id} />
      </TabPanel>
    </main>
  );
}

function CoursesTab({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const { data: courses } = useQuery({
    queryKey: ['studio-courses', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await api.get<{ data: Course[] }>('/creators/me/courses');
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/creators/me/courses', {
        title: title.trim(),
        description: description.trim() || undefined,
      });
    },
    onSuccess: () => {
      setTitle('');
      setDescription('');
      void qc.invalidateQueries({ queryKey: ['studio-courses', userId] });
    },
  });

  return (
    <>
      <section className="glass-panel mb-8 space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">New course</h2>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Course title" />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-high px-4 py-3 text-sm"
          rows={3}
        />
        <Button
          disabled={!title.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          Create course
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-label-caps text-outline">Your courses</h2>
        {(courses ?? []).length === 0 ? (
          <p className="text-sm text-on-surface-variant">No courses yet.</p>
        ) : (
          <ul className="space-y-2">
            {(courses ?? []).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/studio/courses/${c.id}`}
                  className="glass-panel block rounded-xl p-4 transition-colors hover:border-primary/30"
                >
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-sm text-on-surface-variant">
                    /{c.slug}
                    {c.isPublished ? ' · Published' : ' · Draft'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function ProgramsTab({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  const { data: programs } = useQuery({
    queryKey: ['my-programs', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await api.get<{ data: Program[] }>('/creators/me/programs');
      return data.data;
    },
  });

  const { data: myCommunities } = useQuery({
    queryKey: ['my-communities-picker', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: string; name: string }> }>(
        `/creators/${userId}/communities`,
      );
      return data.data;
    },
  });

  const { data: myCourses } = useQuery({
    queryKey: ['my-courses-picker', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: string; title: string }> }>(
        '/creators/me/courses',
      );
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/creators/me/programs', {
        name: name.trim(),
        description: description.trim() || undefined,
        communityId: communityId || undefined,
        courseIds: selectedCourseIds,
        isPublished: false,
      });
    },
    onSuccess: () => {
      setName('');
      setDescription('');
      setCommunityId('');
      setSelectedCourseIds([]);
      void qc.invalidateQueries({ queryKey: ['my-programs', userId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (programId: string) => {
      await api.delete(`/creators/me/programs/${programId}`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-programs', userId] }),
  });

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );
  };

  return (
    <>
      <section className="glass-panel mb-8 space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">Create program</h2>
        <p className="text-xs text-on-surface-variant">
          Group several of your courses into one paid, orderable path — sold as a single item.
        </p>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Program name" />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={3}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
        />
        <select
          value={communityId}
          onChange={(e) => setCommunityId(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
        >
          <option value="">No linked community</option>
          {(myCommunities ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {(myCourses ?? []).length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-on-surface-variant">Courses in this program</p>
            {(myCourses ?? []).map((course) => (
              <label key={course.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCourseIds.includes(course.id)}
                  onChange={() => toggleCourse(course.id)}
                />
                {course.title}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant">
            Create courses first, then group them into a program here.
          </p>
        )}
        <Button
          disabled={!name.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? 'Creating…' : 'Create program'}
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-label-caps text-outline">Your programs</h2>
        {(programs ?? []).length === 0 ? (
          <p className="text-sm text-on-surface-variant">No programs yet.</p>
        ) : (
          <ul className="space-y-3">
            {(programs ?? []).map((program) => (
              <li key={program.id} className="glass-panel rounded-xl p-4 text-sm">
                <p className="font-medium">{program.name}</p>
                {program.description ? (
                  <p className="mt-1 text-xs text-on-surface-variant">{program.description}</p>
                ) : null}
                <p className="mt-1 text-xs text-on-surface-variant">
                  {program.courses.length} course{program.courses.length === 1 ? '' : 's'}
                  {program.isPublished ? ' · Published' : ' · Draft'}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-on-surface-variant">
                  {program.courses.map((row) => (
                    <li key={row.id}>· {row.course?.title ?? row.courseId}</li>
                  ))}
                </ul>
                <Button
                  variant="ghost"
                  className="mt-2 px-0 text-xs text-error"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(program.id)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
