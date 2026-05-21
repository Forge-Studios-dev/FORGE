'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Icon, PageHeader } from '@forge/design-system';
import { getMyVideos } from '@/lib/creator-studio';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { formatCount, timeAgo } from '@/lib/utils';

export default function StudioVideosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
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
                {video.status} · {formatCount(video.viewCount)} views · {timeAgo(video.createdAt)}
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
                <Link href={`/watch/${video.id}`} className="text-sm text-primary hover:underline">
                  View
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
