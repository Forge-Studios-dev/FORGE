'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader, StatusPill, Input, Button } from '@forge/design-system';
import { DataTable, useToast } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { env } from '@/env';

type HeldComment = {
  id: string;
  videoId: string;
  content: string;
  createdAt: string;
  moderationStatus?: string;
  videoTitle?: string | null;
  channelUsername?: string | null;
  user?: { username?: string; displayName?: string } | null;
};

function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parseQ(raw: string | null): string {
  const q = (raw ?? '').trim();
  return q.length >= 2 ? q : '';
}

export default function HeldCommentsPage() {
  return (
    <Suspense fallback={<p className="text-on-surface-variant">Loading held comments…</p>}>
      <HeldCommentsPageInner />
    </Suspense>
  );
}

function HeldCommentsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qParam = parseQ(searchParams.get('q'));
  const pageParam = searchParams.get('page');

  const [page, setPage] = useState(() => parsePage(pageParam));
  const [q, setQ] = useState(qParam);
  const [submitted, setSubmitted] = useState(qParam);
  const qc = useQueryClient();
  const { toast } = useToast();
  const webOrigin = env.NEXT_PUBLIC_WEB_URL?.replace(/\/$/, '') || '';

  useEffect(() => {
    setSubmitted(qParam);
    setQ(qParam);
    setPage(parsePage(pageParam));
  }, [qParam, pageParam]);

  function syncUrl(next: { q?: string; page?: number }) {
    const params = new URLSearchParams();
    const query = (next.q ?? submitted).trim();
    const nextPage = next.page ?? page;
    if (query.length >= 2) params.set('q', query);
    if (nextPage > 1) params.set('page', String(nextPage));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-held-comments', page, submitted],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (submitted.length >= 2) params.set('q', submitted);
      const { data } = await api.get(`/admin/comments/held?${params}`);
      return data.data as {
        data: HeldComment[];
        meta: { total: number; page: number; totalPages: number };
      };
    },
  });

  const release = useMutation({
    mutationFn: (id: string) => api.post(`/admin/comments/${id}/release`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-held-comments'] });
      toast({ title: 'Comment released', variant: 'success' });
    },
    onError: () => toast({ title: 'Could not release comment', variant: 'critical' }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/comments/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-held-comments'] });
      toast({ title: 'Comment removed', variant: 'success' });
    },
    onError: () => toast({ title: 'Could not remove comment', variant: 'critical' }),
  });

  const bulkRelease = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await api.post<{ data: { released: number; requested: number } }>(
        '/admin/comments/held/bulk-release',
        { ids },
      );
      return data.data;
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['admin-held-comments'] });
      toast({
        title: `Released ${result.released} of ${result.requested}`,
        variant: 'success',
      });
    },
    onError: () => toast({ title: 'Bulk release failed', variant: 'critical' }),
  });

  const bulkRemove = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await api.post<{ data: { removed: number; requested: number } }>(
        '/admin/comments/held/bulk-remove',
        { ids },
      );
      return data.data;
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['admin-held-comments'] });
      toast({
        title: `Removed ${result.removed} of ${result.requested}`,
        variant: 'success',
      });
    },
    onError: () => toast({ title: 'Bulk remove failed', variant: 'critical' }),
  });

  const columns = useMemo<ColumnDef<HeldComment, unknown>[]>(
    () => [
      {
        id: 'comment',
        header: 'Comment',
        cell: ({ row }) => (
          <div className="max-w-md">
            <p className="line-clamp-3 text-sm text-on-surface">{row.original.content}</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              @{row.original.user?.username ?? 'user'}
              {row.original.user?.displayName ? ` · ${row.original.user.displayName}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'video',
        header: 'Video',
        cell: ({ row }) => {
          const href = webOrigin
            ? `${webOrigin}/watch/${row.original.videoId}?lc=${encodeURIComponent(row.original.id)}`
            : `/watch/${row.original.videoId}`;
          return (
            <div className="max-w-xs">
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="line-clamp-2 text-sm font-medium text-primary hover:underline"
              >
                {row.original.videoTitle || row.original.videoId}
              </a>
              {row.original.channelUsername ? (
                <p className="text-xs text-on-surface-variant">@{row.original.channelUsername}</p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: () => <StatusPill tone="warning" label="held" />,
      },
      {
        accessorKey: 'createdAt',
        header: 'Flagged',
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-xs text-on-surface-variant">
            {new Date(getValue<string>()).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="text-sm font-semibold text-primary hover:underline disabled:opacity-50"
              disabled={release.isPending}
              onClick={() => release.mutate(row.original.id)}
            >
              Release
            </button>
            <button
              type="button"
              className="text-sm font-semibold text-error hover:underline disabled:opacity-50"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm('Remove this held comment?')) {
                  remove.mutate(row.original.id);
                }
              }}
            >
              Remove
            </button>
          </div>
        ),
      },
    ],
    [release, remove, webOrigin],
  );

  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Held comments"
        subtitle="Auto-flagged video comments awaiting release or removal. Creators can also release from Studio."
      />
      <p className="text-sm text-on-surface-variant">
        Also see{' '}
        <Link href="/content?moderationStatus=held" className="text-primary hover:underline">
          held videos
        </Link>{' '}
        and{' '}
        <Link href="/reports?status=pending" className="text-primary hover:underline">
          pending reports
        </Link>
        .
      </p>

      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          const next = q.trim();
          const query = next.length >= 2 ? next : '';
          setPage(1);
          setSubmitted(query);
          syncUrl({ q: query, page: 1 });
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by comment, author, or video…"
          className="flex-1"
          aria-label="Filter held comments"
        />
        <Button type="submit">Search</Button>
        {submitted ? (
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => {
              setQ('');
              setSubmitted('');
              setPage(1);
              router.replace(pathname, { scroll: false });
            }}
          >
            Clear
          </button>
        ) : null}
      </form>

      {isError ? (
        <div className="space-y-2">
          <p className="text-sm text-error">Could not load held comments.</p>
          <button type="button" className="text-sm text-primary hover:underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        loading={isLoading}
        selectable
        bulkActions={(selected) => (
          <>
            <button
              type="button"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary disabled:opacity-50"
              disabled={bulkRelease.isPending || selected.length === 0}
              onClick={() => bulkRelease.mutate(selected.map((r) => r.id))}
            >
              Release selected
            </button>
            <button
              type="button"
              className="rounded-lg border border-error/40 px-3 py-1.5 text-xs font-semibold text-error disabled:opacity-50"
              disabled={bulkRemove.isPending || selected.length === 0}
              onClick={() => {
                if (window.confirm(`Remove ${selected.length} held comment(s)?`)) {
                  bulkRemove.mutate(selected.map((r) => r.id));
                }
              }}
            >
              Remove selected
            </button>
          </>
        )}
        emptyState={{
          title: 'No held comments',
          description: 'Auto-flagged spam/toxicity comments will show up here.',
        }}
      />

      {meta && meta.totalPages > 1 ? (
        <AdminPagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          label="held comments"
          onPrev={() => {
            const next = Math.max(1, page - 1);
            setPage(next);
            syncUrl({ page: next });
          }}
          onNext={() => {
            const next = page + 1;
            setPage(next);
            syncUrl({ page: next });
          }}
        />
      ) : null}
    </main>
  );
}
