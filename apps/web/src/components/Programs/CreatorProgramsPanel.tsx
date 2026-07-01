'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@forge/design-system';
import { api } from '@/lib/api';

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

export function CreatorProgramsPanel({ creatorId, username }: Props) {
  const { data: programs, isLoading } = useQuery({
    queryKey: ['creator-programs', creatorId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Program[] }>(`/creators/${creatorId}/programs`);
      return data.data ?? [];
    },
  });

  if (isLoading) return null;
  if (!programs?.length) return null;

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-6">
      <h2 className="text-xl font-bold mb-4">Learning programs</h2>
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
    </section>
  );
}
