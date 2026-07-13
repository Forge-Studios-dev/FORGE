'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { EmptyState, FeedGridSkeleton, Icon, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { trackSearchQuery } from '@/lib/analytics';
import { User, Video } from '@/types';
import { FeedCard } from '@/components/FeedCard/FeedCard';

type SearchPayload = {
  videos: Video[];
  users: User[];
  meta: { q: string };
};

function SearchResults({ q }: { q: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const { data } = await api.get<{ data: SearchPayload }>('/search', {
        params: { q, limit: 24 },
      });
      const payload = data.data;
      trackSearchQuery(payload.videos.length + payload.users.length);
      return payload;
    },
  });

  if (q.length > 0 && q.length < 2) {
    return (
      <EmptyState
        icon="search"
        title="Keep typing"
        description="Enter at least 2 characters to search videos and creators."
      />
    );
  }

  if (!q) {
    return (
      <EmptyState
        icon="travel_explore"
        title="Search FORGE"
        description="Find skills, creators, and lessons across crafts, tech, art, music, and more."
      />
    );
  }

  if (isLoading) {
    return <FeedGridSkeleton count={6} />;
  }


  if (isError || !data) {
    return (
      <EmptyState
        icon="error"
        title="Search failed"
        description="Something went wrong. Check your connection and try again."
        action={{ label: 'Retry', href: `/search?q=${encodeURIComponent(q)}` }}
      />
    );
  }

  const empty = data.videos.length === 0 && data.users.length === 0;

  if (empty) {
    return (
      <EmptyState
        icon="search_off"
        title="No results"
        description={`Nothing matched "${data.meta.q}". Try different keywords or browse explore.`}
        action={{ label: 'Explore skills', href: '/explore' }}
      />
    );
  }

  return (
    <div className="space-y-10">
      {data.videos.length > 0 && (
        <section>
          <h2 className="font-label-caps mb-4 text-outline">Videos</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.videos.map((video) => (
              <FeedCard key={video.id} video={video} />
            ))}
          </div>
        </section>
      )}

      {data.users.length > 0 && (
        <section>
          <h2 className="font-label-caps mb-4 text-outline">Creators</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.users.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/${u.username}`}
                  className="glass-panel flex items-center gap-3 rounded-xl p-4 transition hover:border-primary/30"
                >
                  {u.avatarUrl ? (
                    <Image src={u.avatarUrl} alt="" width={48} height={48} className="rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-lg font-bold text-on-primary">
                      {u.displayName[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.displayName}</p>
                    <p className="text-sm text-on-surface-variant">@{u.username}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = (searchParams.get('q') || '').trim();
  const [input, setInput] = useState(q);

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <PageHeader title="Search" subtitle="Find skills, creators, and lessons" />

      <form
        className="mb-10 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const next = input.trim();
          router.push(next ? `/search?q=${encodeURIComponent(next)}` : '/search');
        }}
      >
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search skills, creators, topics…"
            className="pl-11"
          />
        </div>
        <button type="submit" className="primary-button shrink-0 rounded-full px-6 py-2.5 text-sm font-semibold text-on-primary">
          Search
        </button>
      </form>

      <SearchResults q={q} />
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="px-5 py-12 text-on-surface-variant">Loading search…</p>}>
      <SearchPageContent />
    </Suspense>
  );
}
