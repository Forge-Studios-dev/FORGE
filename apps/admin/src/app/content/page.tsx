'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader, StatusPill } from '@forge/design-system';
import { ConfirmDialog, DataTable, useToast } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { isFullAdmin, useAdminProfile } from '@/lib/admin-profile';

interface Video {
  id: string;
  title: string;
  status: string;
  visibility: string;
  moderationStatus?: string;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  userId: string;
  user: { id?: string; displayName: string; username: string };
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'critical' | 'neutral'> = {
  ready: 'success',
  processing: 'warning',
  pending: 'neutral',
  failed: 'critical',
};

const VIDEO_STATUSES = ['ready', 'processing', 'pending', 'failed'] as const;

type ModerationPatch = {
  status?: string;
  visibility?: string;
  moderationStatus?: string;
  moderationNote?: string;
  clearScheduledPublish?: boolean;
};

function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parseStatus(raw: string | null): string {
  if (!raw) return '';
  return (VIDEO_STATUSES as readonly string[]).includes(raw) ? raw : '';
}

export default function ContentPage() {
  return (
    <Suspense fallback={<p className="text-on-surface-variant">Loading content…</p>}>
      <ContentPageInner />
    </Suspense>
  );
}

function ContentPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userIdFilter = searchParams.get('userId') ?? '';
  const moderationFilter = searchParams.get('moderationStatus') ?? '';
  const videoIdFilter = searchParams.get('videoId') ?? '';
  const statusParam = searchParams.get('status');
  const pageParam = searchParams.get('page');

  const [page, setPage] = useState(() => parsePage(pageParam));
  const [statusFilter, setStatusFilter] = useState(() => parseStatus(statusParam));
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    patch: ModerationPatch;
    message: string;
  } | null>(null);
  const [selected, setSelected] = useState<Video[]>([]);
  const [pendingBulkAction, setPendingBulkAction] = useState<{
    patch: ModerationPatch;
    label: string;
    message: string;
  } | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: adminProfile } = useAdminProfile();
  const fullAdmin = isFullAdmin(adminProfile);

  useEffect(() => {
    setStatusFilter(parseStatus(statusParam));
    setPage(parsePage(pageParam));
  }, [statusParam, pageParam]);

  useEffect(() => {
    setPage(1);
  }, [userIdFilter, moderationFilter, videoIdFilter]);

  function syncUrl(next: { status?: string; page?: number }) {
    const params = new URLSearchParams();
    if (userIdFilter) params.set('userId', userIdFilter);
    if (moderationFilter) params.set('moderationStatus', moderationFilter);
    if (videoIdFilter) params.set('videoId', videoIdFilter);
    const status = next.status ?? statusFilter;
    const nextPage = next.page ?? page;
    if (status) params.set('status', status);
    if (nextPage > 1) params.set('page', String(nextPage));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-videos', page, statusFilter, userIdFilter, moderationFilter, videoIdFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (userIdFilter) params.set('userId', userIdFilter);
      if (moderationFilter) params.set('moderationStatus', moderationFilter);
      if (videoIdFilter) params.set('videoId', videoIdFilter);
      const { data } = await api.get(`/admin/videos?${params}`);
      return data.data;
    },
  });

  const updateVideo = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ModerationPatch }) =>
      api.patch(`/admin/videos/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-videos'] });
      setPendingAction(null);
      toast({ title: 'Video updated', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Action failed — video was not updated', variant: 'critical' });
      setPendingAction(null);
    },
  });

  const videos = data?.data as Video[] | undefined;

  const act = (id: string, patch: ModerationPatch, confirm?: string) => {
    if (confirm) {
      setPendingAction({ id, patch, message: confirm });
      return;
    }
    updateVideo.mutate({ id, patch });
  };

  // No dedicated bulk-moderate endpoint exists yet for videos (unlike
  // users/reports/creators, which have PATCH .../bulk) — apply the same patch
  // to each selected video individually and refresh once, so the UX is bulk
  // even though the wire calls aren't.
  const bulkPatch = async (patch: ModerationPatch, label: string) => {
    const ids = selected.map((v) => v.id);
    if (!ids.length) return;
    try {
      await Promise.all(ids.map((id) => api.patch(`/admin/videos/${id}`, patch)));
      toast({ title: `${label} — ${ids.length} video${ids.length === 1 ? '' : 's'}`, variant: 'success' });
      setSelected([]);
      void qc.invalidateQueries({ queryKey: ['admin-videos'] });
    } catch {
      toast({ title: 'Bulk action failed', variant: 'critical' });
    }
  };

  const columns = useMemo<ColumnDef<Video, unknown>[]>(
    () => [
      {
        id: 'title',
        header: 'Title',
        cell: ({ row }) => <span className="line-clamp-1 max-w-xs font-medium">{row.original.title}</span>,
      },
      {
        id: 'creator',
        header: 'Creator',
        cell: ({ row }) => (
          <Link
            href={`/users/${row.original.userId || row.original.user?.id}`}
            className="group block"
          >
            <p className="group-hover:text-primary">{row.original.user?.displayName}</p>
            <p className="text-xs text-outline group-hover:text-primary">@{row.original.user?.username}</p>
          </Link>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue<string>();
          return <StatusPill tone={STATUS_TONE[status] ?? 'neutral'} label={status} />;
        },
      },
      {
        accessorKey: 'moderationStatus',
        header: 'Mod',
        cell: ({ getValue }) => (
          <span className="text-xs text-on-surface-variant">{getValue<string>() ?? 'none'}</span>
        ),
      },
      {
        accessorKey: 'viewCount',
        header: 'Views',
        cell: ({ getValue }) => <span className="tabular-nums text-on-surface-variant">{getValue<number>()}</span>,
      },
      {
        accessorKey: 'createdAt',
        header: 'Date',
        cell: ({ getValue }) => (
          <span className="text-on-surface-variant">{new Date(getValue<string>()).toLocaleDateString()}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const video = row.original;
          return (
            <div className="flex flex-col gap-1 text-xs">
              <button
                type="button"
                onClick={() => act(video.id, { moderationStatus: 'held' }, `Hold "${video.title}" for review?`)}
                className="text-left text-tertiary hover:underline"
              >
                Hold
              </button>
              <button
                type="button"
                onClick={() =>
                  act(video.id, { moderationStatus: 'blocked', visibility: 'private' }, `Block "${video.title}"?`)
                }
                className="text-left text-error hover:underline"
              >
                Block
              </button>
              {video.moderationStatus === 'held' ? (
                <button
                  type="button"
                  onClick={() => act(video.id, { moderationStatus: 'none' })}
                  className="text-left text-secondary hover:underline"
                >
                  Approve
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => act(video.id, { status: 'failed' }, `Remove "${video.title}" from the platform?`)}
                className="text-left text-error hover:underline"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => act(video.id, { clearScheduledPublish: true })}
                className="text-left text-outline hover:underline"
              >
                Clear schedule
              </button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const backfillCaptions = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { scanned: number; updated: number } }>(
        '/admin/videos/backfill-caption-search?limit=25',
      );
      return data.data;
    },
    onSuccess: (result) => {
      toast({
        title: `Caption FTS: scanned ${result.scanned}, updated ${result.updated}`,
        variant: 'success',
      });
    },
    onError: () => toast({ title: 'Caption backfill failed', variant: 'critical' }),
  });

  if (isError) {
    return (
      <section>
        <PageHeader title="Content" subtitle="Moderate videos across the platform" />
        <p className="text-error">Failed to load videos.</p>
        <button type="button" onClick={() => refetch()} className="mt-4 text-sm text-primary hover:underline">
          Retry
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Content"
          subtitle={
            videoIdFilter
              ? 'Single video from audit / deep link'
              : userIdFilter
              ? 'Videos for selected user — clear filter from Users profile'
              : moderationFilter === 'held'
                ? 'Moderation queue — held for review'
                : 'Moderate videos across the platform'
          }
        />
        <div className="flex flex-wrap gap-3">
          {fullAdmin ? (
            <button
              type="button"
              disabled={backfillCaptions.isPending}
              onClick={() => backfillCaptions.mutate()}
              className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface hover:bg-surface-container"
            >
              {backfillCaptions.isPending ? 'Indexing captions…' : 'Backfill caption search'}
            </button>
          ) : null}
          {videoIdFilter ? (
            <Link href="/content" className="text-sm text-primary hover:underline">
              Clear video filter
            </Link>
          ) : null}
          {userIdFilter ? (
            <Link href="/content" className="text-sm text-primary hover:underline">
              Clear user filter
            </Link>
          ) : null}
          {moderationFilter ? (
            <Link href="/content" className="text-sm text-primary hover:underline">
              Clear moderation filter
            </Link>
          ) : (
            <Link href="/content?moderationStatus=held" className="text-sm text-primary hover:underline">
              Held queue
            </Link>
          )}
          <select
            value={statusFilter}
            onChange={(e) => {
              const next = e.target.value;
              setStatusFilter(next);
              setPage(1);
              syncUrl({ status: next, page: 1 });
            }}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            aria-label="Filter by video status"
          >
            <option value="">All statuses</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={videos ?? []}
        getRowId={(v) => v.id}
        loading={isLoading}
        selectable
        onSelectionChange={setSelected}
        emptyState={{ title: 'No videos match this filter', description: 'Try a different status or clear filters.' }}
        bulkActions={() => (
          <>
            <button
              type="button"
              onClick={() =>
                setPendingBulkAction({
                  patch: { moderationStatus: 'held' },
                  label: 'Held',
                  message: `Hold ${selected.length} video(s) for review?`,
                })
              }
              className="rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold hover:border-tertiary hover:text-tertiary"
            >
              Hold
            </button>
            <button
              type="button"
              onClick={() =>
                setPendingBulkAction({
                  patch: { moderationStatus: 'blocked', visibility: 'private' },
                  label: 'Blocked',
                  message: `Block ${selected.length} video(s)?`,
                })
              }
              className="rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold hover:border-critical hover:text-critical"
            >
              Block
            </button>
            <button
              type="button"
              onClick={() =>
                setPendingBulkAction({
                  patch: { status: 'failed' },
                  label: 'Removed',
                  message: `Remove ${selected.length} video(s) from the platform?`,
                })
              }
              className="rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold hover:border-critical hover:text-critical"
            >
              Remove
            </button>
          </>
        )}
      />
      {data?.meta ? (
        <AdminPagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          label="videos"
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

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.message ?? ''}
        confirmLabel="Confirm"
        variant="danger"
        loading={updateVideo.isPending}
        onConfirm={() => pendingAction && updateVideo.mutate({ id: pendingAction.id, patch: pendingAction.patch })}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={pendingBulkAction !== null}
        title={pendingBulkAction?.message ?? ''}
        confirmLabel="Confirm"
        variant="danger"
        onConfirm={() => {
          if (!pendingBulkAction) return;
          const { patch, label } = pendingBulkAction;
          setPendingBulkAction(null);
          void bulkPatch(patch, label);
        }}
        onCancel={() => setPendingBulkAction(null)}
      />
    </section>
  );
}
