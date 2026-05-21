'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Icon, PageHeader } from '@forge/design-system';
import { getMyVideos } from '@/lib/creator-studio';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { formatCount, timeAgo } from '@/lib/utils';
import type { UploadVisibility } from '@/lib/upload-draft';
import type { Video } from '@/types';

export default function StudioVideosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Video | null>(null);
  const [editVisibility, setEditVisibility] = useState<UploadVisibility>('public');
  const [editSchedule, setEditSchedule] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['studio-videos', user?.id],
    queryFn: () => getMyVideos(user?.id),
    enabled: !!user?.id,
  });

  const cancelUpload = async (videoId: string) => {
    setCancellingId(videoId);
    try {
      await api.post(`/videos/${videoId}/cancel-upload`);
      await queryClient.invalidateQueries({ queryKey: ['studio-videos', user?.id] });
    } finally {
      setCancellingId(null);
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
      await queryClient.invalidateQueries({ queryKey: ['studio-videos', user?.id] });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader title="Your videos" subtitle="Manage uploads and processing status" />
      <Link
        href="/upload"
        className="primary-button mb-6 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-on-primary"
      >
        <Icon name="add" />
        New upload
      </Link>

      {isLoading && <p className="text-on-surface-variant">Loading videos…</p>}
      {isError && <p className="text-error">Failed to load videos.</p>}
      {data?.length === 0 && !isLoading && (
        <div className="glass-panel rounded-xl p-10 text-center">
          <Icon name="video_library" className="mb-4 text-4xl text-outline" />
          <p className="text-on-surface-variant">No videos yet. Upload your first lesson.</p>
        </div>
      )}
      <ul className="space-y-3">
        {data?.map((video) => (
          <li key={video.id} className="glass-panel flex items-center justify-between rounded-xl p-4">
            <div>
              <p className="font-medium">{video.title}</p>
              <p className="text-sm text-on-surface-variant">
                {video.status} · {video.visibility}
                {video.scheduledPublishAt
                  ? ` · scheduled ${new Date(video.scheduledPublishAt).toLocaleString()}`
                  : ''}{' '}
                · {formatCount(video.viewCount)} views · {timeAgo(video.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {video.status === 'uploading' ? (
                <button
                  type="button"
                  disabled={cancellingId === video.id}
                  onClick={() => void cancelUpload(video.id)}
                  className="text-sm text-error hover:underline disabled:opacity-50"
                >
                  {cancellingId === video.id ? 'Cancelling…' : 'Cancel upload'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openEdit(video)}
                    className="text-sm text-on-surface-variant hover:underline"
                  >
                    Edit
                  </button>
                  <Link href={`/watch/${video.id}`} className="text-sm text-primary hover:underline">
                    View
                  </Link>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

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
