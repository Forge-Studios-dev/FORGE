'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { EmptyState, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';

type SearchResult = {
  id: string;
  name: string;
  slug: string;
  creatorId: string;
  visibility?: string;
  creator?: { username?: string; displayName?: string; id?: string };
};

export default function DiscoverCommunitiesPage() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: featured } = useQuery({
    queryKey: ['community-featured'],
    queryFn: async () => {
      const { data } = await api.get<{ data: SearchResult[] }>('/communities/discover/featured');
      return data.data ?? [];
    },
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['community-search', searchTerm],
    enabled: searchTerm.length >= 2,
    queryFn: async () => {
      const { data: res } = await api.get<{ data: { data: SearchResult[] } }>(
        `/communities/search?q=${encodeURIComponent(searchTerm)}`,
      );
      return res.data.data;
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <PageHeader
        title="Discover communities"
        subtitle="Find public creator communities on FORGE"
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
          placeholder="Search by name or slug…"
          className="flex-1"
        />
        <button
          type="submit"
          className="primary-button rounded-full px-5 py-2 text-sm font-semibold text-on-primary"
        >
          Search
        </button>
      </form>

      {searchTerm.length < 2 ? (
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">Browse featured public communities or search above.</p>
          {(featured ?? []).length > 0 ? (
            <ul className="space-y-3">
              {(featured ?? []).map((c) => {
                const username = c.creator?.username;
                const href = username
                  ? `/${username}/c/${c.slug}`
                  : `/communities/id/${c.id}`;
                const isPaid = c.visibility === 'paid';
                const subscribeHref = `${href}?subscribe=1`;
                return (
                  <li key={c.id}>
                    <div className="glass-panel rounded-xl p-4 transition-colors hover:border-primary/30">
                      <Link href={href} className="block">
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-sm text-on-surface-variant">
                          {c.creator?.displayName ?? c.creator?.username ?? 'Creator'} · /{c.slug}
                          {isPaid ? ' · Paid community' : ''}
                        </p>
                      </Link>
                      {isPaid ? (
                        <Link
                          href={subscribeHref}
                          className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                        >
                          View membership options →
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon="groups" title="No featured communities yet" />
          )}
        </div>
      ) : isLoading || isFetching ? (
        <p className="text-sm text-on-surface-variant">Searching…</p>
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="No communities found" description="Try a different search term." />
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((c) => {
            const username = c.creator?.username;
            const href = username
              ? `/${username}/c/${c.slug}`
              : `/communities/id/${c.id}`;
            const isPaid = c.visibility === 'paid';
            const subscribeHref = `${href}?subscribe=1`;
            return (
              <li key={c.id}>
                <div className="glass-panel rounded-xl p-4 transition-colors hover:border-primary/30">
                  <Link href={href} className="block">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-sm text-on-surface-variant">
                      {c.creator?.displayName ?? c.creator?.username ?? 'Creator'} · /{c.slug}
                      {isPaid ? ' · Paid community' : ''}
                    </p>
                  </Link>
                  {isPaid ? (
                    <Link
                      href={subscribeHref}
                      className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      View membership options →
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
