'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminPagination } from '@/components/admin/AdminPagination';

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

const STATUS_CLASS: Record<string, string> = {
  ready: 'bg-secondary/10 text-secondary',
  processing: 'bg-tertiary/10 text-tertiary',
  pending: 'bg-surface-container-high text-outline',
  failed: 'bg-error/10 text-error',
};

type ModerationPatch = {
  status?: string;
  visibility?: string;
  moderationStatus?: string;
  moderationNote?: string;
  clearScheduledPublish?: boolean;
};

export default function ContentPage() {
  return (
    <Suspense fallback={<p className="text-on-surface-variant">Loading content…</p>}>
      <ContentPageInner />
    </Suspense>
  );
}

function ContentPageInner() {
  const searchParams = useSearchParams();
  const userIdFilter = searchParams.get('userId') ?? '';
  const moderationFilter = searchParams.get('moderationStatus') ?? '';
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const qc = useQueryClient();

  useEffect(() => {
    setPage(1);
  }, [userIdFilter, statusFilter, moderationFilter]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-videos', page, statusFilter, userIdFilter, moderationFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (userIdFilter) params.set('userId', userIdFilter);
      if (moderationFilter) params.set('moderationStatus', moderationFilter);
      const { data } = await api.get(`/admin/videos?${params}`);
      return data.data;
    },
  });

  const updateVideo = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ModerationPatch }) =>
      api.patch(`/admin/videos/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-videos'] }),
  });

  const videos = data?.data as Video[] | undefined;

  const act = (id: string, patch: ModerationPatch, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    updateVideo.mutate({ id, patch });
  };

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
            userIdFilter
              ? 'Videos for selected user — clear filter from Users profile'
              : moderationFilter === 'held'
                ? 'Moderation queue — held for review'
                : 'Moderate videos across the platform'
          }
        />
        <div className="flex flex-wrap gap-3">
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
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      <AdminDataTable
        headers={['Title', 'Creator', 'Status', 'Mod', 'Views', 'Date', 'Actions']}
        colCount={7}
        isLoading={isLoading}
        isEmpty={!isLoading && !videos?.length}
        emptyMessage="No videos match this filter."
        footer={
          data?.meta ? (
            <AdminPagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              total={data.meta.total}
              label="videos"
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          ) : undefined
        }
      >
        {videos?.map((video) => (
          <tr key={video.id} className="hover:bg-surface-container-high/30">
            <td className="max-w-xs truncate px-4 py-3 font-medium">{video.title}</td>
            <td className="px-4 py-3 text-on-surface-variant">
              <Link
                href={`/users/${video.userId || video.user?.id}`}
                className="group block hover:text-primary"
              >
                <p>{video.user?.displayName}</p>
                <p className="text-xs text-outline group-hover:text-primary">@{video.user?.username}</p>
              </Link>
            </td>
            <td className="px-4 py-3">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[video.status] ?? STATUS_CLASS.pending}`}
              >
                {video.status}
              </span>
            </td>
            <td className="px-4 py-3 text-xs text-on-surface-variant">
              {video.moderationStatus ?? 'none'}
            </td>
            <td className="px-4 py-3 text-on-surface-variant">{video.viewCount}</td>
            <td className="px-4 py-3 text-on-surface-variant">
              {new Date(video.createdAt).toLocaleDateString()}
            </td>
            <td className="px-4 py-3">
              <div className="flex flex-col gap-1 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    act(video.id, { moderationStatus: 'held' }, `Hold "${video.title}" for review?`)
                  }
                  className="text-left text-tertiary hover:underline"
                >
                  Hold
                </button>
                <button
                  type="button"
                  onClick={() =>
                    act(
                      video.id,
                      { moderationStatus: 'blocked', visibility: 'private' },
                      `Block "${video.title}"?`,
                    )
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
                  onClick={() =>
                    act(video.id, { status: 'failed' }, `Remove "${video.title}" from the platform?`)
                  }
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
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </section>
  );
}
