'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
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
import { AgeGateModal } from '@/components/live/AgeGateModal';
import { StreamCountdownLobby } from '@/components/live/StreamCountdownLobby';
import { BrowserGoLivePanel } from '@/components/live/BrowserGoLivePanel';
import { StreamHostDashboard } from '@/components/live/StreamHostDashboard';
import { StreamPollPanel } from '@/components/live/StreamPollPanel';

const ACCESS_MESSAGES: Record<string, string> = {
  login_required: 'Sign in to watch this stream.',
  follow_required: 'Follow this creator to watch.',
  subscription_required: 'An active membership is required.',
  tier_required: 'A higher membership tier is required.',
  paid_event: 'This is a paid event. Access is granted by the creator or platform admin.',
  private: 'This is a private stream.',
  age_confirmation_required: 'Confirm you are 18 or older to watch.',
};

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;

export default function LiveWatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const qc = useQueryClient();
  const { user: me, accessToken } = useAuth();
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [broadcastMode, setBroadcastMode] = useState<'obs' | 'browser' | null>(null);
  const [showObsPanel, setShowObsPanel] = useState(true);
  const [theaterMode, setTheaterMode] = useState(false);

  const checkoutSuccess = searchParams.get('checkout') === 'success';

  const { data: stream, isLoading, isError, refetch } = useQuery({
    queryKey: ['stream', id],
    enabled: id.length > 0,
    queryFn: async () => {
      const { data } = await api.get<{ data: Stream }>(`/streams/${id}`);
      return data.data;
    },
    refetchInterval: (q) => {
      const s = q.state.data;
      if (!s) return 15_000;
      if (s.status === 'live' && s.playbackUrl && !s.accessDenied) return false;
      if (s.status === 'ended') return false;
      if (s.status === 'idle') return 15_000;
      if (s.status === 'live' && !s.playbackUrl && !s.accessDenied) return 15_000;
      return false;
    },
  });

  const { data: replay } = useQuery({
    queryKey: ['stream-replay', id],
    enabled: id.length > 0 && stream?.status === 'ended',
    queryFn: async () => {
      const { data } = await api.get<{
        data: { id: string; title: string; accessDenied?: boolean } | null;
      }>(`/streams/${id}/replay`);
      return data.data;
    },
  });

  useEffect(() => {
    if (checkoutSuccess) void refetch();
  }, [checkoutSuccess, refetch]);

  const endMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/streams/${id}/end`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stream', id] }),
  });

  const isOwner = me && stream && stream.userId === me.id;
  const isScheduledFuture =
    stream?.scheduledAt && new Date(stream.scheduledAt).getTime() > Date.now() && stream.status !== 'live';

  useEffect(() => {
    if (!accessToken || !id) return;
    const socket = getSocket(accessToken);
    if (!socket) return;
    socket.emit('join-stream', { streamId: id });
    const onViewerCount = (payload: { streamId: string; viewerCount: number }) => {
      if (payload.streamId === id) setViewerCount(payload.viewerCount);
    };
    const onStreamStarted = (payload: { streamId: string }) => {
      if (payload.streamId === id) void qc.invalidateQueries({ queryKey: ['stream', id] });
    };
    const onStreamEnded = (payload: { streamId: string }) => {
      if (payload.streamId === id) void qc.invalidateQueries({ queryKey: ['stream', id] });
    };
    socket.on(SocketEvents.STREAM_VIEWER_COUNT, onViewerCount);
    socket.on(SocketEvents.STREAM_STARTED, onStreamStarted);
    socket.on(SocketEvents.STREAM_ENDED, onStreamEnded);
    return () => {
      socket.emit('leave-stream', { streamId: id });
      socket.off(SocketEvents.STREAM_VIEWER_COUNT, onViewerCount);
      socket.off(SocketEvents.STREAM_STARTED, onStreamStarted);
      socket.off(SocketEvents.STREAM_ENDED, onStreamEnded);
    };
  }, [accessToken, id, qc]);

  const displayViewers = viewerCount ?? stream?.viewerCount ?? 0;
  const posterUrl = stream ? resolveStreamPoster(stream) : null;
  const needsAgeGate =
    stream?.accessDenied && stream.accessReason === 'age_confirmation_required' && !ageConfirmed;

  function renderPlayer() {
    if (!stream) return null;

    if (needsAgeGate) {
      return <AgeGateModal onConfirmed={() => { setAgeConfirmed(true); void refetch(); }} />;
    }

    if (stream.accessDenied) {
      const isPaid = stream.accessReason === 'paid_event';
      return (
        <div className="glass-panel flex aspect-video flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="font-medium">Stream access restricted</p>
          <p className="text-sm text-on-surface-variant">
            {ACCESS_MESSAGES[stream.accessReason ?? ''] ?? 'You cannot watch this stream.'}
          </p>
          {isPaid && stream.ticketPriceCents ? (
            <p className="text-xs text-on-surface-variant">
              Ticket: ${(stream.ticketPriceCents / 100).toFixed(2)} · contact the creator if you need access
            </p>
          ) : isPaid && !me ? (
            <Link href="/login" className="text-sm text-primary hover:underline">
              Sign in to check your access
            </Link>
          ) : null}
        </div>
      );
    }

    if (isScheduledFuture) {
      return <StreamCountdownLobby stream={stream} />;
    }

    if (stream.status === 'live' && stream.playbackUrl) {
      return (
        <div className={theaterMode ? 'fixed inset-0 z-50 flex flex-col bg-background p-4' : ''}>
          {theaterMode ? (
            <button
              type="button"
              onClick={() => setTheaterMode(false)}
              className="mb-3 self-end text-sm text-primary hover:underline"
            >
              Exit theater
            </button>
          ) : null}
          <VideoPlayer
            hlsUrl={stream.playbackUrl}
            thumbnailUrl={posterUrl ?? undefined}
            title={stream.title}
            lowLatency={!stream.dvrEnabled}
            isLive
            dvrEnabled={stream.dvrEnabled}
          />
          {!theaterMode ? (
            <button
              type="button"
              onClick={() => setTheaterMode(true)}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Theater mode
            </button>
          ) : null}
        </div>
      );
    }

    return (
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
              ? replay && !replay.accessDenied
                ? 'Watch the replay below.'
                : 'This live session has ended. Replay may appear shortly.'
              : isOwner
                ? 'Start broadcasting with OBS or your browser below.'
                : 'The creator has not started broadcasting yet. Check back in a moment.'}
          </p>
          {stream.status === 'ended' && replay && !replay.accessDenied ? (
            <Link
              href={`/watch/${replay.id}`}
              className="mt-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
            >
              Watch replay
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

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
                {stream.visibility === 'paid_event' && stream.ticketPriceCents
                  ? ` · $${(stream.ticketPriceCents / 100).toFixed(2)} ticket`
                  : ''}
              </p>
            </div>

            {renderPlayer()}

            {isOwner && stream.status !== 'ended' ? (
              <>
                <StreamHostDashboard
                  stream={stream}
                  displayViewers={displayViewers}
                  broadcastMode={broadcastMode}
                />
                <div className="glass-panel space-y-4 rounded-xl border-tertiary/30 p-5 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowObsPanel(true)}
                      className={`rounded-full px-3 py-1 text-xs ${showObsPanel ? 'bg-primary text-on-primary' : 'border border-outline-variant'}`}
                    >
                      OBS / RTMP
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowObsPanel(false)}
                      className={`rounded-full px-3 py-1 text-xs ${!showObsPanel ? 'bg-primary text-on-primary' : 'border border-outline-variant'}`}
                    >
                      Browser
                    </button>
                  </div>
                  {showObsPanel ? (
                    <>
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
                    </>
                  ) : (
                    <BrowserGoLivePanel
                      streamId={id}
                      livekitUrl={LIVEKIT_URL}
                      onBroadcastingChange={(active) =>
                        setBroadcastMode(active ? 'browser' : null)
                      }
                    />
                  )}
                  {stream.streamKey?.startsWith('mock-') ? (
                    <p className="text-xs text-error">
                      Mock stream — end and recreate from Studio with Mux configured.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={endMutation.isPending}
                    onClick={() => {
                      if (window.confirm('End this live stream?')) endMutation.mutate();
                    }}
                    className="rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 py-2 font-medium transition hover:border-primary/30 disabled:opacity-50"
                  >
                    {endMutation.isPending ? 'Ending…' : 'End stream'}
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <StreamChatPanel
            streamId={id}
            streamOwnerId={stream.userId}
            chatEnabled={stream.chatEnabled !== false}
            chatMode={stream.chatMode ?? 'all'}
            slowModeSeconds={stream.slowModeSeconds}
            pinnedMessageId={stream.pinnedMessageId}
          />
          <StreamPollPanel streamId={id} isHost={!!isOwner} />
        </div>
      )}
    </main>
  );
}
