'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { EmptyState, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';

type CatalogCourse = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  lessonCount: number;
  creator?: { id: string; username: string; displayName: string } | null;
};

export default function DiscoverCoursesPage() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: featured } = useQuery({
    queryKey: ['courses-featured'],
    queryFn: async () => {
      const { data } = await api.get<{ data: CatalogCourse[] }>('/courses/discover/featured');
      return data.data ?? [];
    },
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['courses-discover', searchTerm],
    enabled: searchTerm.length >= 2,
    queryFn: async () => {
      const { data: res } = await api.get<{ data: CatalogCourse[] }>(
        `/courses/discover?q=${encodeURIComponent(searchTerm)}`,
      );
      return res.data ?? [];
    },
  });

  const renderCourse = (course: CatalogCourse) => {
    const username = course.creator?.username;
    return (
      <li
        key={course.id}
        className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4"
      >
        <p className="font-medium">{course.title}</p>
        {course.description ? (
          <p className="mt-1 text-sm text-on-surface-variant line-clamp-2">{course.description}</p>
        ) : null}
        <p className="mt-2 text-xs text-on-surface-variant">
          {course.lessonCount} lesson{course.lessonCount === 1 ? '' : 's'}
          {course.creator ? ` · ${course.creator.displayName}` : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href={`/courses/${course.id}`} className="text-primary text-sm">
            View course
          </Link>
          {username ? (
            <Link href={`/${username}`} className="text-primary text-sm">
              Creator profile
            </Link>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <Link href="/studio" className="mb-4 inline-block text-sm text-primary">
        ← Studio
      </Link>
      <PageHeader
        title="Discover courses"
        subtitle="Find published creator courses on FORGE"
      />

      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearchTerm(query.trim());
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or topic…"
          className="flex-1"
        />
        <button
          type="submit"
          className="primary-button rounded-full px-5 py-2 text-sm font-semibold text-on-primary"
        >
          Search
        </button>
      </form>

      {searchTerm.length >= 2 ? (
        isLoading || isFetching ? (
          <p className="text-sm text-on-surface-variant">Searching…</p>
        ) : (data ?? []).length === 0 ? (
          <EmptyState title="No courses found" description="Try a different search term." />
        ) : (
          <ul className="space-y-3">{data!.map(renderCourse)}</ul>
        )
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            Browse featured courses or search above (min 2 characters).
          </p>
          {(featured ?? []).length > 0 ? (
            <ul className="space-y-3">{featured!.map(renderCourse)}</ul>
          ) : (
            <p className="text-sm text-on-surface-variant">No published courses yet.</p>
          )}
        </div>
      )}
    </main>
  );
}
