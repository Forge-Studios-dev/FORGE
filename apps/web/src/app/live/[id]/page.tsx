'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Stream, User } from '@/types';
import { VideoPlayer } from '@/components/VideoPlayer/VideoPlayerLazy';
import { StreamChatPanel } from '@/components/StreamChat/StreamChatPanel';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import { SocketEvents } from '@forge/shared-types';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonBlock } from '@/components/LoadingSkeleton';
import { resolveStreamPoster } from '@/lib/stream-poster';

const ACCESS_MESSAGES: Record<string, string> = {
  login_required: 'Sign in to watch this stream.',
  follow_required: 'Follow this creator to watch.',
  subscription_required: 'An active membership is required.',
  tier_required: 'A higher membership tier is required.',
  paid_event: 'Paid event access is coming soon.',
  private: 'This is a private stream.',
};

export default function LiveWatchPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const qc = useQueryClient();
  const { user: me, accessToken } = useAuth();
  const [viewerCount, setViewerCount] = useState<number | null>(null);

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
      if (s.status === 'live' && !s.playbackUrl && !s.accessDenied) return 5000;
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

  useEffect(() => {
    if (!accessToken || !id) return;
    const socket = getSocket(accessToken);
    if (!socket) return;
    socket.emit('join-stream', { streamId: id });
    const onViewerCount = (payload: { streamId: string; viewerCount: number }) => {
      if (payload.streamId === id) setViewerCount(payload.viewerCount);
    };
    socket.on(SocketEvents.STREAM_VIEWER_COUNT, onViewerCount);
    return () => {
      socket.emit('leave-stream', { streamId: id });
      socket.off(SocketEvents.STREAM_VIEWER_COUNT, onViewerCount);
    };
  }, [accessToken, id]);

  const displayViewers = viewerCount ?? stream?.viewerCount ?? 0;
  const posterUrl = stream ? resolveStreamPoster(stream) : null;

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
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <div>
              <h1 className="font-display-forge text-2xl font-bold">{stream.title}</h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                {(stream.user as User)?.displayName ?? 'Creator'} ·{' '}
                <span className="capitalize">{stream.status}</span>
                {displayViewers ? ` · ${displayViewers} viewers` : ''}
              </p>
            </div>

            {stream.accessDenied ? (
              <div className="glass-panel flex aspect-video flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="font-medium">Stream access restricted</p>
                <p className="text-sm text-on-surface-variant">
                  {ACCESS_MESSAGES[stream.accessReason ?? ''] ?? 'You cannot watch this stream.'}
                </p>
              </div>
            ) : stream.status === 'live' && stream.playbackUrl ? (
              <VideoPlayer
                hlsUrl={stream.playbackUrl}
                thumbnailUrl={posterUrl ?? undefined}
                title={stream.title}
                lowLatency
              />
            ) : (
              <div className="glass-panel relative aspect-video overflow-hidden">
                {posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
                ) : null}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/50 px-6 text-center">
                  <p className="text-sm font-medium text-on-surface">
                    {stream.status === 'ended' ? 'Stream ended' : 'Waiting for broadcast'}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {stream.status === 'ended'
                      ? 'This live session has ended.'
                      : isOwner
                        ? 'Start streaming in OBS using the RTMP credentials below. Playback will begin automatically once you are live.'
                        : 'The creator has not started broadcasting yet. Check back in a moment.'}
                  </p>
                </div>
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
                {stream.streamKey?.startsWith('mock-') ? (
                  <p className="text-xs text-error">
                    This stream was created without a valid Mux connection. End it and create a new stream from Studio.
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={endMutation.isPending}
                  onClick={() => endMutation.mutate()}
                  className="mt-2 rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 py-2 font-medium transition hover:border-primary/30 disabled:opacity-50"
                >
                  {endMutation.isPending ? 'Ending…' : 'End stream'}
                </button>
                {endMutation.isError ? (
                  <p className="text-xs text-error">Could not end stream.</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <StreamChatPanel
            streamId={id}
            streamOwnerId={stream.userId}
            chatEnabled={stream.chatEnabled !== false}
            slowModeSeconds={stream.slowModeSeconds}
          />
        </div>
      )}
    </main>
  );
}
