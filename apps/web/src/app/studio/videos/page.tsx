'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getActiveUpload, subscribeActiveUpload } from '@/lib/upload-manager';
import { Icon, PageHeader } from '@forge/design-system';
import { getStudioVideos } from '@/lib/creator-studio';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { formatCount, timeAgo } from '@/lib/utils';
import type { UploadVisibility } from '@/lib/upload-draft';
import type { Video } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  uploading: 'Uploading',
  processing: 'Processing',
  ready: 'Published',
  failed: 'Failed',
  pending: 'Pending',
};

function statusClass(status: string) {
  if (status === 'ready') return 'bg-secondary/10 text-secondary';
  if (status === 'processing' || status === 'uploading') return 'bg-tertiary/10 text-tertiary';
  if (status === 'failed') return 'bg-error/10 text-error';
  return 'bg-surface-container-high text-outline';
}

function VideoRow({
  video,
  cancellingId,
  onCancel,
  onEdit,
  browserUploadPct,
}: {
  video: Video;
  cancellingId: string | null;
  onCancel: (id: string) => void;
  onEdit?: (v: Video) => void;
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
          <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(video.status)}`}>
            {STATUS_LABEL[video.status] ?? video.status}
          </span>
          {video.visibility}
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
        {video.status === 'ready' && onEdit ? (
          <button
            type="button"
            onClick={() => onEdit(video)}
            className="text-sm text-on-surface-variant hover:underline"
          >
            Edit
          </button>
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [editing, setEditing] = useState<Video | null>(null);
  const [editVisibility, setEditVisibility] = useState<UploadVisibility>('public');
  const [editSchedule, setEditSchedule] = useState('');
  const [saving, setSaving] = useState(false);
  const [browserUploadPct, setBrowserUploadPct] = useState<number | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const a = getActiveUpload();
      setActiveVideoId(a?.videoId || null);
      setBrowserUploadPct(a?.phase === 'uploading' ? a.progress : null);
    };
    sync();
    return subscribeActiveUpload(sync);
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['studio-videos'],
    queryFn: getStudioVideos,
    enabled: !!user?.id,
    refetchInterval: (q) => {
      const list = q.state.data ?? [];
      const needsPoll = list.some((v) => v.status === 'uploading' || v.status === 'processing');
      return needsPoll ? 5000 : false;
    },
  });

  const groups = useMemo(() => {
    const list = data ?? [];
    return {
      inProgress: list.filter((v) => v.status === 'uploading' || v.status === 'processing'),
      published: list.filter((v) => v.status === 'ready'),
      failed: list.filter((v) => v.status === 'failed' || v.status === 'pending'),
    };
  }, [data]);

  const cancelVideo = async (videoId: string) => {
    if (!window.confirm('Remove this video and free the upload slot?')) return;
    setCancellingId(videoId);
    try {
      await api.post(`/videos/${videoId}/cancel-upload`);
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

  const openEdit = (video: Video) => {
    setEditing(video);
    setEditVisibility((video.visibility as UploadVisibility) ?? 'public');
    setEditSchedule(
      video.scheduledPublishAt
        ? new Date(video.scheduledPublishAt).toISOString().slice(0, 16)
        : '',
    );
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.patch(`/videos/${editing.id}`, {
        visibility: editVisibility,
        scheduledPublishAt: editSchedule ? new Date(editSchedule).toISOString() : null,
      });
      await queryClient.invalidateQueries({ queryKey: ['studio-videos'] });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader title="Your videos" subtitle="Manage uploads, processing, and published lessons" />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/upload"
          className="primary-button inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-on-primary"
        >
          <Icon name="add" />
          New upload
        </Link>
        {groups.inProgress.length > 0 ? (
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

      {groups.inProgress.length > 0 ? (
        <div className="mb-8 rounded-xl border border-tertiary/30 bg-tertiary/5 p-4">
          <p className="text-sm font-medium text-on-surface">
            {groups.inProgress.length} video{groups.inProgress.length === 1 ? '' : 's'} in progress
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            New uploads are blocked until these finish or you cancel them below.
          </p>
        </div>
      ) : null}

      {isLoading && <p className="text-on-surface-variant">Loading videos…</p>}
      {isError && <p className="text-error">Failed to load videos.</p>}

      {!isLoading && !data?.length ? (
        <div className="glass-panel rounded-xl p-10 text-center">
          <Icon name="video_library" className="mb-4 text-4xl text-outline" />
          <p className="text-on-surface-variant">No videos yet. Upload your first lesson.</p>
        </div>
      ) : null}

      {groups.inProgress.length > 0 ? (
        <section className="mb-8">
          <h2 className="font-label-caps mb-3 text-outline">In progress</h2>
          <ul className="space-y-3">
            {groups.inProgress.map((video) => (
              <VideoRow
                key={video.id}
                video={video}
                cancellingId={cancellingId}
                onCancel={cancelVideo}
                browserUploadPct={
                  video.id === activeVideoId ? browserUploadPct : null
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      {groups.failed.length > 0 ? (
        <section className="mb-8">
          <h2 className="font-label-caps mb-3 text-outline">Failed</h2>
          <ul className="space-y-3">
            {groups.failed.map((video) => (
              <VideoRow
                key={video.id}
                video={video}
                cancellingId={cancellingId}
                onCancel={cancelVideo}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {groups.published.length > 0 ? (
        <section>
          <h2 className="font-label-caps mb-3 text-outline">Published</h2>
          <ul className="space-y-3">
            {groups.published.map((video) => (
              <VideoRow
                key={video.id}
                video={video}
                cancellingId={cancellingId}
                onEdit={openEdit}
                onCancel={cancelVideo}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-panel w-full max-w-md space-y-4 rounded-2xl p-6">
            <h2 className="font-display-forge text-lg font-semibold">Edit lesson</h2>
            <p className="text-sm text-on-surface-variant">{editing.title}</p>
            <fieldset className="space-y-2">
              <legend className="font-label-caps text-outline">Visibility</legend>
              {(['public', 'unlisted', 'private'] as UploadVisibility[]).map((vis) => (
                <label key={vis} className="flex items-center gap-2 text-sm capitalize">
                  <input
                    type="radio"
                    checked={editVisibility === vis}
                    onChange={() => setEditVisibility(vis)}
                  />
                  {vis}
                </label>
              ))}
            </fieldset>
            <label className="block text-sm">
              <span className="font-label-caps text-outline">Schedule publish (optional)</span>
              <input
                type="datetime-local"
                value={editSchedule}
                onChange={(e) => setEditSchedule(e.target.value)}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="text-sm text-on-surface-variant"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveEdit()}
                className="primary-button rounded-full px-5 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
