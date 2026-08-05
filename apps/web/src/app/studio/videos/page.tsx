'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { SocketEvents } from '@forge/shared-types';
import { getActiveUpload, subscribeActiveUpload } from '@/lib/upload-manager';
import { EmptyState, Icon, ListSkeleton, PageHeader, StatusPill, type StatusTone } from '@forge/design-system';
import { ConfirmDialog } from '@forge/design-system/client';
import { fetchStudioLibrary, type StudioVideoSort } from '@/lib/creator-studio';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { formatCount, timeAgo } from '@/lib/utils';
import { getSocket } from '@/lib/socket';
import type { Video } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  uploading: 'Uploading',
  processing: 'Processing',
  ready: 'Published',
  failed: 'Failed',
  pending: 'Pending',
};

function statusTone(status: string): StatusTone {
  if (status === 'ready') return 'success';
  if (status === 'processing' || status === 'uploading') return 'warning';
  if (status === 'failed') return 'critical';
  return 'neutral';
}

const VISIBILITY_ICON: Record<string, string> = {
  public: 'public',
  unlisted: 'link',
  private: 'lock',
  followers: 'group',
  subscribers: 'workspace_premium',
  tier: 'workspace_premium',
  paid_event: 'payments',
};

const VISIBILITY_LABEL: Record<string, string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
  followers: 'Subscribers',
  subscribers: 'Members',
  tier: 'Tier members',
  paid_event: 'Paid event',
};

function visibilityLabel(visibility: string): string {
  return VISIBILITY_LABEL[visibility] ?? visibility.replace(/_/g, ' ');
}

function formatPublishedAt(video: Video): string {
  const raw = video.publishedAt ?? video.scheduledPublishAt ?? video.createdAt;
  return new Date(raw).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function VideoRow({
  video,
  cancellingId,
  onCancel,
  browserUploadPct,
}: {
  video: Video;
  cancellingId: string | null;
  onCancel: (id: string) => void;
  browserUploadPct?: number | null;
}) {
  const inProgress = video.status === 'uploading' || video.status === 'processing';
  const canCancel =
    video.status === 'uploading' ||
    video.status === 'processing' ||
    video.status === 'failed' ||
    video.status === 'pending';

  return (
    <li className="glass-panel flex items-center justify-between gap-4 rounded-xl p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{video.title}</p>
        <p className="text-sm text-on-surface-variant">
          <StatusPill
            tone={statusTone(video.status)}
            label={STATUS_LABEL[video.status] ?? video.status}
            className="mr-2"
          />
          {visibilityLabel(video.visibility)}
          {video.scheduledPublishAt
            ? ` · scheduled ${new Date(video.scheduledPublishAt).toLocaleString()}`
            : ''}
          {video.status === 'ready'
            ? ` · ${formatCount(video.viewCount)} views · ${timeAgo(video.createdAt)}`
            : ` · started ${timeAgo(video.createdAt)}`}
        </p>
        {inProgress ? (
          <p className="mt-1 text-xs text-tertiary">
            {video.status === 'uploading'
              ? browserUploadPct != null
                ? `Uploading ${browserUploadPct}% in this browser tab.`
                : 'File is uploading to storage. Cancel to free the slot and upload again.'
              : 'Transcoding in progress. Cancel only if this is stuck.'}
          </p>
        ) : null}
        {video.status === 'uploading' && browserUploadPct != null ? (
          <div className="mt-2 h-1 max-w-xs overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full bg-tertiary transition-all"
              style={{ width: `${browserUploadPct}%` }}
            />
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {canCancel ? (
          <button
            type="button"
            disabled={cancellingId === video.id}
            onClick={() => onCancel(video.id)}
            className="text-sm text-error hover:underline disabled:opacity-50"
          >
            {cancellingId === video.id ? 'Cancelling…' : 'Cancel'}
          </button>
        ) : null}
        {video.status !== 'uploading' ? (
          <Link href={`/studio/videos/${video.id}`} className="text-sm text-on-surface-variant hover:underline">
            Edit
          </Link>
        ) : null}
        {video.status === 'ready' ? (
          <Link href={`/watch/${video.id}`} className="text-sm text-primary hover:underline">
            View
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export default function StudioVideosPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <StudioVideosPageInner />
    </Suspense>
  );
}

function StudioVideosPageInner() {
  const searchParams = useSearchParams();
  const { user, accessToken, isCreator } = useAuth();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [browserUploadPct, setBrowserUploadPct] = useState<number | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search')?.trim() ?? '');
  const [sort, setSort] = useState<StudioVideoSort>('recent');
  const [statusFilter, setStatusFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');

  const PAGE_SIZE = 30;

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    if (!socket) return;
    const onReady = () => {
      void queryClient.invalidateQueries({ queryKey: ['studio-videos'] });
    };
    socket.on(SocketEvents.VIDEO_READY, onReady);
    return () => {
      socket.off(SocketEvents.VIDEO_READY, onReady);
    };
  }, [accessToken, queryClient]);

  useEffect(() => {
    const sync = () => {
      const a = getActiveUpload();
      setActiveVideoId(a?.videoId || null);
      setBrowserUploadPct(a?.phase === 'uploading' ? a.progress : null);
    };
    sync();
    return subscribeActiveUpload(sync);
  }, []);

  useEffect(() => {
    const fromUrl = searchParams.get('search') ?? '';
    setSearch(fromUrl);
    setDebouncedSearch(fromUrl.trim());
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data: pages,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['studio-videos', debouncedSearch, sort, statusFilter, visibilityFilter],
    enabled: !!user?.id && isCreator,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchStudioLibrary({
        search: debouncedSearch,
        sort,
        status: statusFilter || undefined,
        visibility: visibilityFilter || undefined,
        page: pageParam,
        limit: PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    refetchInterval: (q) => {
      const loaded = (q.state.data?.pages ?? []).flatMap((p) => p.items);
      const needsPoll = loaded.some(
        (v) => v.status === 'uploading' || v.status === 'processing',
      );
      if (!needsPoll) return false;
      const socket = accessToken ? getSocket(accessToken) : null;
      if (socket?.connected) return false;
      return 30_000;
    },
  });

  const data = useMemo(() => (pages?.pages ?? []).flatMap((p) => p.items), [pages]);
  const totalCount = pages?.pages[0]?.pagination.total ?? data.length;
  const inProgressCount = data.filter((v) => v.status === 'uploading' || v.status === 'processing').length;

  const cancelVideo = async (videoId: string) => {
    setCancellingId(videoId);
    try {
      await api.post(`/videos/${videoId}/cancel-upload`);
      setCancelConfirmId(null);
      await queryClient.invalidateQueries({ queryKey: ['studio-videos'] });
    } finally {
      setCancellingId(null);
    }
  };

  const releaseAllStuck = async () => {
    setReleasing(true);
    try {
      await api.post('/videos/release-stuck-uploads');
      await refetch();
    } finally {
      setReleasing(false);
    }
  };

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <PageHeader title="Videos" subtitle="Creator access required." />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Videos"
          subtitle={
            totalCount > 0
              ? `${totalCount} videos · Manage uploads, processing, publishing, and performance.`
              : 'Manage uploads, processing, publishing, and performance.'
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/upload"
            className="primary-button inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-on-primary"
          >
            <Icon name="add" />
            New upload
          </Link>
          {inProgressCount > 0 ? (
            <button
              type="button"
              disabled={releasing}
              onClick={() => void releaseAllStuck()}
              className="rounded-full border border-outline-variant px-4 py-2 text-sm hover:border-primary disabled:opacity-50"
            >
              {releasing ? 'Clearing…' : 'Clear stuck uploads'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your videos by title"
            aria-label="Search your videos by title"
            className="w-full rounded-full border border-outline-variant bg-surface-container-low py-2 pl-10 pr-4 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-on-surface-variant">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface"
          >
            <option value="">All</option>
            <option value="ready">Published</option>
            <option value="processing">Processing</option>
            <option value="uploading">Uploading</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-on-surface-variant">
          Visibility
          <select
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value)}
            aria-label="Filter by visibility"
            className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface"
          >
            <option value="">All</option>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
            <option value="followers">Subscribers</option>
            <option value="subscribers">Members</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-on-surface-variant">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as StudioVideoSort)}
            aria-label="Sort videos"
            className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface"
          >
            <option value="recent">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="views">Most viewed</option>
            <option value="title">Title (A–Z)</option>
          </select>
        </label>
      </div>

      {inProgressCount > 0 ? (
        <div className="rounded-2xl border border-tertiary/30 bg-tertiary/5 p-4">
          <p className="text-sm font-medium text-on-surface">
            {inProgressCount} video{inProgressCount === 1 ? '' : 's'} in progress
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            New uploads are blocked until these finish or you cancel them below.
          </p>
        </div>
      ) : null}

      {isLoading ? <ListSkeleton rows={6} /> : null}
      {isError ? <p className="text-error">Failed to load videos.</p> : null}

      {!isLoading && !isError && !data.length ? (
        <EmptyState
          icon="video_library"
          title={debouncedSearch ? 'No matching videos' : 'No videos yet'}
          description={
            debouncedSearch
              ? `Nothing in your library matches “${debouncedSearch}”.`
              : 'Upload your first video to start building your channel.'
          }
          action={{ label: 'Upload a video', href: '/upload' }}
        />
      ) : null}

      {!isLoading && data.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant/30 md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-outline-variant/30 bg-surface-container-low text-xs uppercase tracking-wide text-outline">
                <tr>
                  <th className="px-4 py-3 font-medium">Video</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Visibility</th>
                  <th className="px-4 py-3 font-medium">Views</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((video) => {
                  const inProgress = video.status === 'uploading' || video.status === 'processing';
                  const canCancel =
                    video.status === 'uploading' ||
                    video.status === 'processing' ||
                    video.status === 'failed' ||
                    video.status === 'pending';
                  const uploadPct = video.id === activeVideoId ? browserUploadPct : null;

                  return (
                    <tr key={video.id} className="border-b border-outline-variant/20 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex min-w-[280px] items-start gap-3">
                          <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-container-high">
                            {video.thumbnailUrl ? (
                              <Image
                                src={video.thumbnailUrl}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="96px"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-outline">
                                <Icon name="movie" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{video.title}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {video.skillTags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag.id}
                                  className="font-label-caps rounded-full border border-outline-variant/40 px-2 py-0.5 text-[10px] text-on-surface-variant"
                                >
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                            {inProgress && uploadPct != null ? (
                              <div className="mt-2 h-1 max-w-[180px] overflow-hidden rounded-full bg-surface-container-high">
                                <div
                                  className="h-full bg-tertiary transition-all"
                                  style={{ width: `${uploadPct}%` }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill
                          tone={statusTone(video.status)}
                          label={STATUS_LABEL[video.status] ?? video.status}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 capitalize text-on-surface-variant">
                          <Icon name={VISIBILITY_ICON[video.visibility] ?? 'visibility'} className="text-base" />
                          {visibilityLabel(video.visibility)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {video.status === 'ready' ? formatCount(video.viewCount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">{formatPublishedAt(video)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                          {canCancel ? (
                            <button
                              type="button"
                              disabled={cancellingId === video.id}
                              onClick={() => setCancelConfirmId(video.id)}
                              className="text-sm text-error hover:underline disabled:opacity-50"
                            >
                              {cancellingId === video.id ? 'Cancelling…' : 'Cancel'}
                            </button>
                          ) : null}
                          {video.status !== 'uploading' ? (
                            <Link
                              href={`/studio/videos/${video.id}`}
                              className="text-sm text-on-surface-variant hover:underline"
                            >
                              Edit
                            </Link>
                          ) : null}
                          {video.status === 'ready' ? (
                            <Link href={`/watch/${video.id}`} className="text-sm text-primary hover:underline">
                              View
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {data.map((video) => (
              <VideoRow
                key={video.id}
                video={video}
                cancellingId={cancellingId}
                onCancel={setCancelConfirmId}
                browserUploadPct={video.id === activeVideoId ? browserUploadPct : null}
              />
            ))}
          </ul>
        </>
      ) : null}

      {hasNextPage ? (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
            className="rounded-full border border-outline-variant px-6 py-2 text-sm hover:border-primary disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!cancelConfirmId}
        title="Cancel upload?"
        description="Remove this video and free the upload slot so you can try again."
        confirmLabel="Cancel upload"
        onConfirm={() => {
          if (cancelConfirmId) void cancelVideo(cancelConfirmId);
        }}
        onCancel={() => setCancelConfirmId(null)}
        loading={!!cancellingId}
      />
    </main>
  );
}
