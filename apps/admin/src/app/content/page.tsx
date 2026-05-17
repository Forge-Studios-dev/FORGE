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
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const qc = useQueryClient();

  useEffect(() => {
    setPage(1);
  }, [userIdFilter, statusFilter]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-videos', page, statusFilter, userIdFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (userIdFilter) params.set('userId', userIdFilter);
      const { data } = await api.get(`/admin/videos?${params}`);
      return data.data;
    },
  });

  const updateVideo = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/videos/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-videos'] }),
  });

  const videos = data?.data as Video[] | undefined;

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
              : 'Moderate videos across the platform'
          }
        />
        {userIdFilter ? (
          <Link href="/content" className="text-sm text-primary hover:underline">
            Clear user filter
          </Link>
        ) : null}
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

      <AdminDataTable
        headers={['Title', 'Creator', 'Status', 'Views', 'Likes', 'Date', 'Actions']}
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
            <td className="px-4 py-3 text-on-surface-variant">{video.viewCount}</td>
            <td className="px-4 py-3 text-on-surface-variant">{video.likeCount}</td>
            <td className="px-4 py-3 text-on-surface-variant">
              {new Date(video.createdAt).toLocaleDateString()}
            </td>
            <td className="px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(`Remove "${video.title}" from the platform?`)) return;
                  updateVideo.mutate({ id: video.id, status: 'failed' });
                }}
                className="text-xs text-error hover:underline"
              >
                Remove
              </button>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </section>
  );
}
