'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Stream, User } from '@/types';
import { VideoPlayer } from '@/components/VideoPlayer/VideoPlayerLazy';
import { useAuth } from '@/lib/auth';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonBlock } from '@/components/LoadingSkeleton';

export default function LiveWatchPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const qc = useQueryClient();
  const { user: me } = useAuth();

  const { data: stream, isLoading, isError, refetch } = useQuery({
    queryKey: ['stream', id],
    enabled: id.length > 0,
    queryFn: async () => {
      const { data } = await api.get<{ data: Stream }>(`/streams/${id}`);
      return data.data;
    },
    refetchInterval: (q) => {
      const s = q.state.data;
      if (!s) return 5000;
      if (s.status === 'live' && !s.playbackUrl) return 5000;
      if (s.status === 'idle') return 5000;
      return false;
    },
  });

  const endMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/streams/${id}/end`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stream', id] }),
  });

  const isOwner = me && stream && stream.userId === me.id;

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <Link href="/live" className="mb-6 inline-block text-sm text-primary hover:underline">
        ← All live streams
      </Link>

      {isLoading ? (
        <div className="space-y-6">
          <SkeletonBlock className="h-8 w-64" />
          <SkeletonBlock className="aspect-video w-full" />
        </div>
      ) : isError || !stream ? (
        <EmptyState
          icon="videocam_off"
          title="Stream unavailable"
          description="This live session may have ended or could not be loaded."
          action={{ label: 'Browse live', href: '/live' }}
          onAction={() => refetch()}
        />
      ) : (
        <div className="space-y-6">
          <div>
            <h1 className="font-display-forge text-2xl font-bold">{stream.title}</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              {(stream.user as User)?.displayName ?? 'Creator'} ·{' '}
              <span className="capitalize">{stream.status}</span>
              {stream.viewerCount ? ` · ${stream.viewerCount} viewers` : ''}
            </p>
          </div>

          {stream.playbackUrl ? (
            <VideoPlayer
              hlsUrl={stream.playbackUrl}
              thumbnailUrl={stream.thumbnailUrl}
              title={stream.title}
              lowLatency
            />
          ) : (
            <div className="glass-panel flex aspect-video flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm text-on-surface-variant">
                {stream.status === 'live'
                  ? 'Playback is not available yet. Refresh in a moment once Mux activates the stream.'
                  : 'This stream is not broadcasting yet. When the creator goes live in OBS, playback will appear here.'}
              </p>
            </div>
          )}

          {isOwner && stream.status !== 'ended' ? (
            <div className="glass-panel space-y-3 rounded-xl border-tertiary/30 p-5 text-sm">
              <p className="font-medium text-tertiary">Broadcast with OBS</p>
              <p className="text-on-surface-variant">
                Server:{' '}
                <code className="text-on-surface">
                  {stream.rtmpUrl ?? 'rtmps://global-live.mux.com:443/app'}
                </code>
              </p>
              <p className="text-on-surface-variant">
                Stream key:{' '}
                <code className="break-all text-on-surface">{stream.streamKey ?? '—'}</code>
              </p>
              <button
                type="button"
                disabled={endMutation.isPending}
                onClick={() => endMutation.mutate()}
                className="mt-2 rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 py-2 font-medium transition hover:border-primary/30 disabled:opacity-50"
              >
                {endMutation.isPending ? 'Ending…' : 'End stream'}
              </button>
              {endMutation.isError ? <p className="text-xs text-error">Could not end stream.</p> : null}
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
