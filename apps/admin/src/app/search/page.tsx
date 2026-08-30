'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { env } from '@/env';

interface SearchUser {
  id: string;
  username: string;
  displayName: string;
}

interface SearchVideo {
  id: string;
  title: string;
  user?: { id?: string; username: string; displayName: string };
}

type SearchPayload = {
  videos: SearchVideo[];
  users: SearchUser[];
  meta: { q: string };
};

const WEB_ORIGIN = env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';

function parseQ(raw: string | null): string {
  const q = (raw ?? '').trim();
  return q.length >= 2 ? q : '';
}

export default function AdminSearchPage() {
  return (
    <Suspense fallback={<p className="text-on-surface-variant">Loading search…</p>}>
      <AdminSearchPageInner />
    </Suspense>
  );
}

function AdminSearchPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qParam = parseQ(searchParams.get('q'));

  const [q, setQ] = useState(qParam || searchParams.get('q') || '');
  const [submitted, setSubmitted] = useState(qParam);

  useEffect(() => {
    const next = parseQ(searchParams.get('q'));
    setSubmitted(next);
    setQ(searchParams.get('q') ?? '');
  }, [searchParams]);

  function syncUrl(nextQ: string) {
    const trimmed = nextQ.trim();
    const params = new URLSearchParams();
    if (trimmed.length >= 2) params.set('q', trimmed);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-search', submitted],
    enabled: submitted.length >= 2,
    queryFn: async () => {
      const { data } = await api.get<{ data: SearchPayload }>('/search', {
        params: { q: submitted, limit: 30 },
      });
      return data.data;
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim();
    if (t.length >= 2) {
      setSubmitted(t);
      syncUrl(t);
    }
  }

  return (
    <section className="max-w-4xl">
      <PageHeader
        title="Search"
        subtitle="Public search index for quick lookups — moderation stays in Content and Reports"
      />

      <form onSubmit={onSubmit} className="mb-8 flex flex-col gap-2 sm:flex-row">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search videos or creators…"
          className="flex-1"
        />
        <Button type="submit">Search</Button>
      </form>

      {submitted.length > 0 && submitted.length < 2 ? (
        <p className="text-sm text-tertiary">Enter at least 2 characters.</p>
      ) : null}
      {isLoading && submitted.length >= 2 ? <p className="text-on-surface-variant">Searching…</p> : null}
      {isError ? <p className="text-error">Search failed.</p> : null}

      {data && (
        <div className="space-y-8">
          {data.videos.length === 0 && data.users.length === 0 ? (
            <p className="text-on-surface-variant">No results for &ldquo;{data.meta.q}&rdquo;.</p>
          ) : null}

          {data.videos.length > 0 ? (
            <section>
              <h2 className="font-label-caps mb-3 text-outline">Videos</h2>
              <ul className="space-y-2">
                {data.videos.map((v) => (
                  <li
                    key={v.id}
                    className="glass-panel flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{v.title}</p>
                      <p className="truncate text-on-surface-variant">
                        {v.user?.displayName ?? '—'} · id {v.id.slice(0, 8)}…
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {v.user?.id ? (
                        <Link
                          href={`/content?userId=${v.user.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Creator videos
                        </Link>
                      ) : null}
                      <a
                        href={`${WEB_ORIGIN}/watch/${v.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Open on web
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.users.length > 0 ? (
            <section>
              <h2 className="font-label-caps mb-3 text-outline">Creators</h2>
              <ul className="space-y-2">
                {data.users.map((u) => (
                  <li
                    key={u.id}
                    className="glass-panel flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{u.displayName}</p>
                      <p className="text-on-surface-variant">@{u.username}</p>
                    </div>
                    <Link href={`/users/${u.id}`} className="text-xs text-primary hover:underline">
                      View profile
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </section>
  );
}
