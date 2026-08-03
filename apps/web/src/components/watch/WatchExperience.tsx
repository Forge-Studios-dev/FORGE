'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { StreamChatReplayPanel } from '@/components/StreamChat/StreamChatReplayPanel';
import { Playlist, SubscriptionTier, Video } from '@/types';
import { VideoPlayer } from '@/components/VideoPlayer/VideoPlayerLazy';
import { VideoInfo } from '@/components/VideoPlayer/VideoInfo';
import { CommentsPanel } from '@/components/Comments/CommentsPanel';
import { AuthGateModal } from '@/components/gates/AuthGateModal';
import { VerifyEmailGateModal } from '@/components/gates/VerifyEmailGateModal';
import {
  engageBlockedMessage,
  getEngageBlockReason,
  type EngageBlockReason,
} from '@/lib/engage-access';
import { ReportContentButton } from '@/components/watch/ReportContentButton';
import { PlaylistQueueRail } from '@/components/watch/PlaylistQueueRail';
import { NoAccessCallout } from '@/components/NoAccessCallout';
import { MembershipPanel } from '@/components/Membership/MembershipPanel';
import { PaywallCard } from '@forge/design-system';
import { useAuth } from '@/lib/auth';
import { useAccessSession } from '@/lib/access-session';
import { AccessSessionConflict } from '@/components/Community/AccessSessionConflict';
import { api } from '@/lib/api';
import { parseTimeQueryParam } from '@/lib/watch-url';
import { extractVideoChapters } from '@/lib/description-timestamps';
import { ChaptersBar } from '@/components/watch/ChaptersBar';
import { TranscriptPanel } from '@/components/watch/TranscriptPanel';
import { useMiniPlayer } from '@/lib/miniplayer';
import {
  buildWatchListHref,
  pickShuffledNextId,
  readLoopPlaylistPreference,
  writeLoopPlaylistPreference,
} from '@/lib/playlist-watch-prefs';

const AUTOPLAY_KEY = 'forge.watch.autoplay';
const LOOP_KEY = 'forge.watch.loop';
const THEATER_KEY = 'forge.watch.theater';

const ACCESS_MESSAGES: Record<string, string> = {
  login_required: 'Sign in to watch this video.',
  follow_required: 'Subscribe to this channel to watch.',
  subscription_required: 'An active membership is required.',
  tier_required: 'A higher membership tier is required.',
  paid_event: 'This is a paid event. Access is granted by the creator or platform admin.',
  private: 'This video is private.',
};

function readAutoplayPreference(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(AUTOPLAY_KEY);
  if (raw === null) return true;
  return raw === '1';
}

function readLoopPreference(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(LOOP_KEY) === '1';
}

function readTheaterPreference(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(THEATER_KEY) === '1';
}

export function WatchExperience({
  video,
  sidebar,
}: {
  video: Video;
  sidebar?: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listId = searchParams.get('list');
  const shuffleOn = searchParams.get('shuffle') === '1';
  const tParam = searchParams.get('t');
  const { isGuest, user } = useAuth();
  const { open: openMiniPlayer, close: closeMiniPlayer } = useMiniPlayer();
  const [engageBlock, setEngageBlock] = useState<EngageBlockReason | null>(null);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const playbackSecondsRef = useRef(0);
  const [theaterMode, setTheaterMode] = useState(false);
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [loopVideo, setLoopVideo] = useState(false);
  const [loopPlaylist, setLoopPlaylist] = useState(false);
  const [upNextHint, setUpNextHint] = useState<string | null>(null);
  const [seekToSeconds, setSeekToSeconds] = useState<number | null>(null);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [endCountdown, setEndCountdown] = useState(5);
  const blockReason = getEngageBlockReason(user, isGuest);
  const onEngageBlocked = blockReason ? () => setEngageBlock(blockReason) : undefined;
  const canPlay = video.status === 'ready' && !!video.hlsUrl;
  const isPrivate = video.visibility === 'private';
  const isOwner = user?.id === video.userId;
  const needsPremiumSession =
    !!user &&
    !isOwner &&
    (video.visibility === 'subscribers' || video.visibility === 'tier');

  const watchHref = useCallback(
    (id: string) => buildWatchListHref(id, listId, shuffleOn),
    [listId, shuffleOn],
  );

  useEffect(() => {
    setAutoplayNext(readAutoplayPreference());
    setLoopVideo(readLoopPreference());
    setLoopPlaylist(readLoopPlaylistPreference());
    setTheaterMode(readTheaterPreference());
    setShowEndScreen(false);
    setPlaybackSeconds(0);
    playbackSecondsRef.current = 0;
    closeMiniPlayer();
    const t = parseTimeQueryParam(tParam);
    setSeekToSeconds(t != null && t > 0 ? t : null);
  }, [video.id, tParam, closeMiniPlayer]);

  const setTheater = (on: boolean) => {
    setTheaterMode(on);
    try {
      window.localStorage.setItem(THEATER_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    playbackSecondsRef.current = playbackSeconds;
  }, [playbackSeconds]);

  /** Persist playback into the floating miniplayer when leaving watch for another surface. */
  useEffect(() => {
    const videoId = video.id;
    const title = video.title;
    const hlsUrl = video.hlsUrl;
    const thumbnailUrl = video.thumbnailUrl;
    return () => {
      if (!hlsUrl || typeof window === 'undefined') return;
      const path = window.location.pathname;
      if (path.startsWith(`/watch/${videoId}`)) return;
      if (path.startsWith('/watch/') || path.startsWith('/embed')) {
        closeMiniPlayer();
        return;
      }
      const seconds = playbackSecondsRef.current;
      if (seconds < 2) return;
      openMiniPlayer({
        videoId,
        title,
        hlsUrl,
        thumbnailUrl,
        seconds,
      });
    };
  }, [
    video.id,
    video.title,
    video.hlsUrl,
    video.thumbnailUrl,
    openMiniPlayer,
    closeMiniPlayer,
  ]);

  const minimizeToDock = () => {
    if (!video.hlsUrl) return;
    openMiniPlayer({
      videoId: video.id,
      title: video.title,
      hlsUrl: video.hlsUrl,
      thumbnailUrl: video.thumbnailUrl,
      seconds: playbackSecondsRef.current,
    });
    router.push('/');
  };

  const { data: playlistQueue } = useQuery({
    queryKey: ['playlist-queue', listId],
    enabled: !!listId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: Playlist }>(`/playlists/${listId}`);
      return data.data;
    },
  });

  const playlistNext = useMemo(() => {
    const items = playlistQueue?.items ?? [];
    if (!items.length || !listId) return null;

    const toNext = (item: (typeof items)[number]): Video => {
      if (item.video) return item.video;
      return { id: item.videoId, title: 'Next in playlist' } as Video;
    };

    if (shuffleOn) {
      const nextId = pickShuffledNextId(
        items.map((i) => i.videoId),
        video.id,
        listId,
      );
      if (!nextId) {
        if (loopPlaylist && items[0]) return toNext(items[0]);
        return null;
      }
      const next = items.find((i) => i.videoId === nextId);
      return next ? toNext(next) : null;
    }

    const idx = items.findIndex((item) => item.videoId === video.id);
    if (idx < 0) return null;
    if (idx < items.length - 1) return toNext(items[idx + 1]);
    if (loopPlaylist) return toNext(items[0]);
    return null;
  }, [playlistQueue, video.id, listId, shuffleOn, loopPlaylist]);

  const { data: relatedNext } = useQuery({
    queryKey: ['watch-up-next', video.id],
    enabled:
      canPlay && (!listId || (playlistQueue !== undefined && playlistNext == null)),
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: Video[] } }>(
        `/videos/${video.id}/related?limit=4`,
      );
      const list = (data.data?.data ?? []).filter((v) => v.id !== video.id);
      return list[0] ?? null;
    },
  });

  const upNext = playlistNext ?? relatedNext ?? null;
  const chapters = useMemo(
    () => extractVideoChapters(video.description),
    [video.description],
  );

  const handleEnded = useCallback(() => {
    if (loopVideo) return;
    if (!upNext) return;
    setShowEndScreen(true);
    setEndCountdown(5);
    setUpNextHint(null);
  }, [upNext, loopVideo]);

  useEffect(() => {
    if (loopVideo || !showEndScreen || !autoplayNext || !upNext) return;
    if (endCountdown <= 0) {
      setUpNextHint('Playing next…');
      router.push(watchHref(upNext.id));
      return;
    }
    const timer = window.setTimeout(() => setEndCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [showEndScreen, autoplayNext, endCountdown, upNext, router, watchHref, loopVideo]);

  const toggleAutoplay = () => {
    setAutoplayNext((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(AUTOPLAY_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const toggleLoop = () => {
    setLoopVideo((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(LOOP_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      if (next) setShowEndScreen(false);
      return next;
    });
  };

  const toggleLoopPlaylist = () => {
    setLoopPlaylist((prev) => {
      const next = !prev;
      writeLoopPlaylistPreference(next);
      return next;
    });
  };

  const toggleShuffle = () => {
    if (!listId) return;
    const params = new URLSearchParams(searchParams.toString());
    if (shuffleOn) params.delete('shuffle');
    else params.set('shuffle', '1');
    const q = params.toString();
    router.replace(q ? `/watch/${video.id}?${q}` : `/watch/${video.id}`);
  };

  const { data: membership } = useQuery({
    queryKey: ['membership', video.userId, user?.id],
    enabled: needsPremiumSession,
    queryFn: async () => {
      const { data } = await api.get<{ data: { active: boolean } }>(
        `/creators/${video.userId}/membership/me`,
      );
      return data.data;
    },
  });

  const sessionEnabled = needsPremiumSession && !!membership?.active;
  const { ready: sessionReady, conflict, takeOver } = useAccessSession(
    'playback',
    video.id,
    sessionEnabled,
  );

  const { data: creatorTiers } = useQuery({
    queryKey: ['tiers', video.userId],
    enabled: !!video.accessDenied && !!video.requiredTierId,
    queryFn: async () => {
      const { data } = await api.get<{ data: SubscriptionTier[] }>(
        `/creators/${video.userId}/tiers`,
      );
      return data.data;
    },
  });
  const requiredTier = creatorTiers?.find((t) => t.id === video.requiredTierId) ?? null;

  if (isPrivate && (isGuest || !isOwner)) {
    return (
      <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
        <NoAccessCallout
          title="Private video"
          description={
            isGuest
              ? 'Sign in with the channel account that owns this video to watch it.'
              : 'You do not have permission to watch this private video.'
          }
        />
      </main>
    );
  }

  if (video.accessDenied) {
    return (
      <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
        <div className="mb-6">
          <PaywallCard
            title="Video access restricted"
            message={ACCESS_MESSAGES[video.accessReason ?? ''] ?? 'You cannot watch this video.'}
            tierName={requiredTier?.name}
            priceLabel={
              requiredTier
                ? `${requiredTier.currency} ${(requiredTier.priceCents / 100).toFixed(0)}/${requiredTier.billingInterval ?? 'mo'}`
                : undefined
            }
          />
        </div>
        <h1 className="font-display-forge mb-4 text-2xl font-bold">{video.title}</h1>
        <MembershipPanel creatorId={video.userId} highlightTierId={video.requiredTierId} />
      </main>
    );
  }

  const playerBlock = canPlay ? (
    sessionEnabled && conflict ? (
      <AccessSessionConflict message={conflict} onTakeOver={takeOver} />
    ) : sessionEnabled && !sessionReady ? (
      <div className="glass-panel flex aspect-video items-center justify-center rounded-xl">
        <p className="text-sm text-on-surface-variant">Starting secure session…</p>
      </div>
    ) : (
        <div className={theaterMode ? 'fixed inset-0 z-50 flex flex-col bg-background p-4' : 'relative'}>
        {theaterMode ? (
          <button
            type="button"
            onClick={() => setTheater(false)}
            aria-label="Exit theater mode"
            className="mb-3 self-end text-sm text-primary hover:underline"
          >
            Exit theater
          </button>
        ) : null}
        <div className="relative">
          <VideoPlayer
            videoId={video.id}
            hlsUrl={video.hlsUrl!}
            thumbnailUrl={video.thumbnailUrl}
            title={video.title}
            onPlaybackTime={setPlaybackSeconds}
            onEnded={handleEnded}
            seekToSeconds={seekToSeconds}
            loop={loopVideo}
            onMiniplayer={minimizeToDock}
            captionUrl={video.captionUrl}
            captionTracks={video.captionTracks}
          />
          {showEndScreen && upNext ? (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/75 p-4"
              role="dialog"
              aria-label="Up next"
            >
              <div className="w-full max-w-sm rounded-2xl bg-surface-container-high p-5 text-center shadow-xl">
                <p className="font-label-caps text-xs text-outline">Up next</p>
                <h3 className="mt-2 line-clamp-2 font-display-forge text-lg font-semibold text-on-surface">
                  {upNext.title}
                </h3>
                {autoplayNext ? (
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Playing in {endCountdown}s…
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-on-surface-variant">Autoplay is off</p>
                )}
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEndScreen(false);
                      setEndCountdown(5);
                    }}
                    className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(watchHref(upNext.id))}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
                  >
                    Play now
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        {!theaterMode ? (
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setTheater(true)}
              aria-label="Theater mode"
              className="text-xs text-primary hover:underline"
            >
              Theater mode
            </button>
            {canPlay && video.hlsUrl ? (
              <button
                type="button"
                onClick={minimizeToDock}
                aria-label="Miniplayer"
                className="text-xs text-primary hover:underline"
              >
                Miniplayer
              </button>
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant">
              <input
                type="checkbox"
                checked={autoplayNext}
                onChange={toggleAutoplay}
                className="rounded border-outline-variant"
              />
              Autoplay next
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant">
              <input
                type="checkbox"
                checked={loopVideo}
                onChange={toggleLoop}
                className="rounded border-outline-variant"
              />
              Loop video
            </label>
            {listId ? (
              <>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={shuffleOn}
                    onChange={toggleShuffle}
                    className="rounded border-outline-variant"
                  />
                  Shuffle
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={loopPlaylist}
                    onChange={toggleLoopPlaylist}
                    className="rounded border-outline-variant"
                  />
                  Loop playlist
                </label>
              </>
            ) : null}
            {upNextHint ? (
              <span className="text-xs text-secondary" role="status">
                {upNextHint}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  ) : (
    <div className="glass-panel flex aspect-video flex-col items-center justify-center rounded-xl p-8 text-center">
      <p className="font-display-forge text-lg font-semibold">
        {video.status === 'processing' ? 'Processing your video' : 'Playback not available'}
      </p>
      <p className="mt-2 text-sm text-on-surface-variant">
        {video.status === 'processing'
          ? 'This video is being transcoded. Check back soon.'
          : video.status === 'failed'
            ? 'This upload could not be processed.'
            : 'This video is not ready for playback yet.'}
      </p>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-[var(--spacing-container-max)] px-5 py-6 md:px-12 md:py-8">
      <div
        className={`forge-fade-in grid grid-cols-1 gap-8 ${
          theaterMode ? '' : 'lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]'
        }`}
      >
        <div className="min-w-0 space-y-6">
          {playerBlock}
          {!theaterMode && chapters.length > 0 ? (
            <ChaptersBar
              chapters={chapters}
              durationSeconds={video.durationSeconds}
              currentSeconds={playbackSeconds}
              onSeek={(seconds) => setSeekToSeconds(seconds)}
            />
          ) : null}
          {!theaterMode ? (
            <TranscriptPanel
              videoId={video.id}
              captionUrl={video.captionUrl}
              captionTracks={video.captionTracks}
              currentSeconds={playbackSeconds}
              onSeek={(seconds) => setSeekToSeconds(seconds)}
            />
          ) : null}
          {!theaterMode ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <VideoInfo
                    video={video}
                    onGuestAction={onEngageBlocked}
                    onSeekTo={(seconds) => setSeekToSeconds(seconds)}
                    playbackSeconds={playbackSeconds}
                    listId={listId}
                  />
                </div>
                <ReportContentButton targetType="video" targetId={video.id} />
              </div>
              {video.sourceStreamId ? (
                <StreamChatReplayPanel
                  streamId={video.sourceStreamId}
                  playbackSeconds={playbackSeconds}
                />
              ) : null}
              <CommentsPanel
                videoId={video.id}
                videoOwnerId={video.userId}
                commentCount={video.commentCount}
                onGuestInteract={onEngageBlocked}
                onSeek={(seconds) => setSeekToSeconds(seconds)}
              />
            </>
          ) : null}
        </div>
        {!theaterMode ? (
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {listId && playlistQueue ? (
              <>
                <h2 className="font-label-caps text-outline">Playlist</h2>
                <PlaylistQueueRail
                  playlist={playlistQueue}
                  currentVideoId={video.id}
                  listId={listId}
                  shuffle={shuffleOn}
                />
              </>
            ) : sidebar ? (
              <>
                <h2 className="font-label-caps text-outline">Up next</h2>
                {sidebar}
              </>
            ) : null}
          </aside>
        ) : null}
      </div>
      <AuthGateModal
        open={engageBlock === 'guest'}
        onClose={() => setEngageBlock(null)}
        message={engageBlockedMessage('guest')}
      />
      <VerifyEmailGateModal
        open={engageBlock === 'unverified'}
        onClose={() => setEngageBlock(null)}
        message={engageBlockedMessage('unverified')}
      />
    </main>
  );
}
