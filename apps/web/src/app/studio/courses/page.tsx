'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button, Input, PageHeader } from '@forge/design-system';
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

export default function StudioCoursesPage() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const { data: courses } = useQuery({
    queryKey: ['studio-courses', user?.id],
    enabled: !!user?.id && isCreator,
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
      void qc.invalidateQueries({ queryKey: ['studio-courses', user?.id] });
    },
  });

  if (!isCreator) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <PageHeader title="Courses" subtitle="Create structured learning paths for your members" />

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
    </main>
  );
}
