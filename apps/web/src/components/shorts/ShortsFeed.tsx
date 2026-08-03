'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { EmptyState, Icon, IconButton } from '@forge/design-system';
import { api } from '@/lib/api';
import { Video } from '@/types';
import { formatCount } from '@/lib/utils';
import { VideoPlayer } from '@/components/VideoPlayer/VideoPlayerLazy';
import { useAuth } from '@/lib/auth';
import { AuthGateModal } from '@/components/gates/AuthGateModal';
import { VerifyEmailGateModal } from '@/components/gates/VerifyEmailGateModal';
import {
  engageBlockedMessage,
  getEngageBlockReason,
  type EngageBlockReason,
} from '@/lib/engage-access';
import {
  engageErrorReason,
  setChannelNotifyLevel,
  toggleSubscribe,
  toggleVideoDislike,
  toggleVideoLike,
  type ChannelNotifyLevel,
} from '@/lib/engage-mutations';
import { ReportContentButton } from '@/components/watch/ReportContentButton';
import { CommentsPanel } from '@/components/Comments/CommentsPanel';

type ShortsPage = {
  data: Video[];
  nextCursor: string | null;
};

function ShortSlide({
  video,
  active,
  onGuestAction,
  onHidden,
}: {
  video: Video;
  active: boolean;
  onGuestAction?: () => void;
  onHidden?: (videoId: string) => void;
}) {
  const { user: me, isGuest } = useAuth();
  const [liked, setLiked] = useState(!!video.viewerLiked);
  const [disliked, setDisliked] = useState(!!video.viewerDisliked);
  const [likeCount, setLikeCount] = useState(video.likeCount ?? 0);
  const [subscribed, setSubscribed] = useState(
    !!(video.viewerSubscribed ?? video.viewerFollowingCreator),
  );
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [notifyLevel, setNotifyLevel] = useState<ChannelNotifyLevel>('all');
  const [engageBlock, setEngageBlock] = useState<EngageBlockReason | null>(null);
  const [heartBurst, setHeartBurst] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const lastTapRef = useRef(0);
  const blockReason = onGuestAction ? null : getEngageBlockReason(me, isGuest);
  const canPlay = active && video.status === 'ready' && !!video.hlsUrl;
  const isOwn = !!me?.id && me.id === video.userId;

  useEffect(() => {
    setLiked(!!video.viewerLiked);
    setDisliked(!!video.viewerDisliked);
    setLikeCount(video.likeCount ?? 0);
    setSubscribed(!!(video.viewerSubscribed ?? video.viewerFollowingCreator));
    setNotifyOpen(false);
    setMoreOpen(false);
  }, [
    video.id,
    video.viewerLiked,
    video.viewerDisliked,
    video.likeCount,
    video.viewerSubscribed,
    video.viewerFollowingCreator,
  ]);

  const gated = (action: () => void) => {
    if (onGuestAction) {
      onGuestAction();
      return;
    }
    if (blockReason) {
      setEngageBlock(blockReason);
      return;
    }
    action();
  };

  const share = async () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/shorts?v=${video.id}`
        : `/shorts?v=${video.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, url });
        return;
      }
    } catch {
      /* cancelled or fallback */
    }
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareHint('Link copied');
        window.setTimeout(() => setShareHint(null), 2000);
      }
    } catch {
      setShareHint('Could not share');
      window.setTimeout(() => setShareHint(null), 2000);
    }
  };

  const notInterested = async () => {
    try {
      await api.post(`/videos/${video.id}/not-interested`);
      onHidden?.(video.id);
    } catch (err) {
      const reason = engageErrorReason(err);
      if (reason === 'guest' || reason === 'unverified') setEngageBlock(reason);
    } finally {
      setMoreOpen(false);
    }
  };

  const dontRecommend = async () => {
    try {
      await api.post(`/videos/${video.id}/dont-recommend-channel`);
      onHidden?.(video.id);
    } catch (err) {
      const reason = engageErrorReason(err);
      if (reason === 'guest' || reason === 'unverified') setEngageBlock(reason);
    } finally {
      setMoreOpen(false);
    }
  };

  const likeMutation = useMutation({
    mutationFn: async (nextLiked: boolean) => {
      await toggleVideoLike(video.id, !nextLiked);
    },
    onMutate: (nextLiked) => {
      const was = liked;
      setLiked(nextLiked);
      if (nextLiked) setDisliked(false);
      setLikeCount((c) => {
        if (nextLiked && !was) return c + 1;
        if (!nextLiked && was) return Math.max(0, c - 1);
        return c;
      });
    },
    onError: (err) => {
      setLiked(!!video.viewerLiked);
      setDisliked(!!video.viewerDisliked);
      setLikeCount(video.likeCount ?? 0);
      const reason = engageErrorReason(err);
      if (reason === 'guest' || reason === 'unverified') setEngageBlock(reason);
    },
  });

  const dislikeMutation = useMutation({
    mutationFn: async (nextDisliked: boolean) => {
      await toggleVideoDislike(video.id, !nextDisliked);
    },
    onMutate: (nextDisliked) => {
      const wasLiked = liked;
      setDisliked(nextDisliked);
      if (nextDisliked && wasLiked) {
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      }
    },
    onError: (err) => {
      setLiked(!!video.viewerLiked);
      setDisliked(!!video.viewerDisliked);
      setLikeCount(video.likeCount ?? 0);
      const reason = engageErrorReason(err);
      if (reason === 'guest' || reason === 'unverified') setEngageBlock(reason);
    },
  });

  const onDoubleTapLike = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      lastTapRef.current = 0;
      setHeartBurst(true);
      window.setTimeout(() => setHeartBurst(false), 700);
      if (!liked) gated(() => likeMutation.mutate(true));
      return;
    }
    lastTapRef.current = now;
  };

  const subscribeMutation = useMutation({
    mutationFn: async (next: boolean) => {
      await toggleSubscribe(video.userId, !next);
    },
    onMutate: (next) => {
      setSubscribed(next);
      if (!next) setNotifyOpen(false);
    },
    onError: (err) => {
      setSubscribed(!!(video.viewerSubscribed ?? video.viewerFollowingCreator));
      const reason = engageErrorReason(err);
      if (reason === 'guest' || reason === 'unverified') setEngageBlock(reason);
    },
  });

  const notifyMutation = useMutation({
    mutationFn: async (level: ChannelNotifyLevel) => {
      await setChannelNotifyLevel(video.userId, level);
    },
    onMutate: (level) => setNotifyLevel(level),
    onSuccess: () => setNotifyOpen(false),
    onError: (err) => {
      const reason = engageErrorReason(err);
      if (reason === 'guest' || reason === 'unverified') setEngageBlock(reason);
    },
  });

  return (
    <section
      className="relative flex h-dvh w-full shrink-0 snap-start snap-always items-center justify-center bg-black"
      aria-label={video.title}
    >
      <div className="relative aspect-[9/16] h-full max-h-full w-full max-w-[420px] overflow-hidden bg-surface-container-lowest">
        {canPlay ? (
          <div className="absolute inset-0">
            <VideoPlayer
              videoId={video.id}
              hlsUrl={video.hlsUrl!}
              thumbnailUrl={video.thumbnailUrl}
              title={video.title}
              variant="shorts"
            />
          </div>
        ) : video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            fill
            className="object-cover"
            sizes="420px"
            priority={active}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-on-surface-variant">Short</div>
        )}

        {/* Double-tap to like (YouTube Shorts parity); keeps rail controls clickable. */}
        <button
          type="button"
          aria-label="Double tap to like"
          className="absolute inset-0 z-[1] cursor-default bg-transparent"
          style={{ right: '4.5rem', bottom: '6rem' }}
          onClick={onDoubleTapLike}
        />
        {heartBurst ? (
          <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center">
            <Icon name="favorite" filled className="text-6xl text-error drop-shadow-lg" />
          </div>
        ) : null}

        <div className="absolute right-3 top-3 z-[3]">
          <button
            type="button"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
            onClick={() => setMoreOpen((o) => !o)}
          >
            <Icon name="more_vert" />
          </button>
          {moreOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-11 z-10 w-48 overflow-hidden rounded-xl bg-surface-container-high text-on-surface shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-xs hover:bg-surface-container-highest"
                onClick={() => gated(() => void notInterested())}
              >
                Not interested
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-xs hover:bg-surface-container-highest"
                onClick={() => gated(() => void dontRecommend())}
              >
                Don&apos;t recommend channel
              </button>
              <div className="border-t border-outline-variant/30 px-1 py-1">
                <ReportContentButton
                  targetType="video"
                  targetId={video.id}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-on-surface hover:bg-surface-container-highest"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pb-6">
          <p className="line-clamp-2 text-base font-semibold text-white">{video.title}</p>
          {video.user ? (
            <Link
              href={`/${video.user.username}`}
              className="pointer-events-auto mt-2 inline-flex items-center gap-2 text-sm text-white/90 hover:underline"
            >
              @{video.user.username}
            </Link>
          ) : null}
          <p className="mt-1 text-xs text-white/70">{formatCount(video.viewCount)} views</p>
        </div>

        <div className="absolute bottom-24 right-3 z-[3] flex flex-col items-center gap-3">
          <button
            type="button"
            disabled={likeMutation.isPending}
            onClick={() => gated(() => likeMutation.mutate(!liked))}
            className="flex flex-col items-center gap-1"
            aria-pressed={liked}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70">
              <Icon name="thumb_up" filled={liked} className={liked ? 'text-primary' : undefined} />
            </span>
            <span className="text-xs font-medium text-white">{formatCount(likeCount)}</span>
          </button>

          <button
            type="button"
            disabled={dislikeMutation.isPending}
            onClick={() => gated(() => dislikeMutation.mutate(!disliked))}
            className="flex flex-col items-center gap-1"
            aria-pressed={disliked}
            aria-label={disliked ? 'Remove dislike' : 'Dislike'}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70">
              <Icon name="thumb_down" filled={disliked} />
            </span>
            <span className="text-xs font-medium text-white">Dislike</span>
          </button>

          {!isOwn ? (
            <div className="relative flex flex-col items-center gap-1">
              <button
                type="button"
                disabled={subscribeMutation.isPending}
                onClick={() =>
                  gated(() => {
                    if (subscribed) setNotifyOpen((o) => !o);
                    else subscribeMutation.mutate(true);
                  })
                }
                className="flex flex-col items-center gap-1"
                aria-pressed={subscribed}
                aria-label={subscribed ? 'Subscription options' : 'Subscribe'}
                aria-haspopup={subscribed ? 'menu' : undefined}
                aria-expanded={subscribed ? notifyOpen : undefined}
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-sm ${
                    subscribed ? 'bg-white text-black' : 'bg-black/50 text-white hover:bg-black/70'
                  }`}
                >
                  <Icon name={subscribed ? 'notifications' : 'subscriptions'} />
                </span>
                <span className="text-xs font-medium text-white">
                  {subscribed ? 'Subscribed' : 'Subscribe'}
                </span>
              </button>
              {subscribed && notifyOpen ? (
                <div
                  role="menu"
                  className="absolute bottom-full right-0 z-10 mb-2 w-40 overflow-hidden rounded-xl bg-surface-container-high text-on-surface shadow-lg"
                >
                  {(
                    [
                      ['all', 'All'],
                      ['personalized', 'Personalized'],
                      ['none', 'None'],
                    ] as const
                  ).map(([level, label]) => (
                    <button
                      key={level}
                      type="button"
                      role="menuitemradio"
                      aria-checked={notifyLevel === level}
                      className={`block w-full px-3 py-2 text-left text-xs hover:bg-surface-container-highest ${
                        notifyLevel === level ? 'text-primary' : ''
                      }`}
                      onClick={() => gated(() => notifyMutation.mutate(level))}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full border-t border-outline-variant/30 px-3 py-2 text-left text-xs text-error hover:bg-surface-container-highest"
                    onClick={() => gated(() => subscribeMutation.mutate(false))}
                  >
                    Unsubscribe
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            className="flex flex-col items-center gap-1"
            aria-label="Comments"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70">
              <Icon name="chat_bubble" />
            </span>
            <span className="text-xs font-medium text-white">
              {formatCount(video.commentCount ?? 0)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void share()}
            className="flex flex-col items-center gap-1"
            aria-label="Share"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70">
              <Icon name="share" />
            </span>
            <span className="text-xs font-medium text-white">{shareHint ?? 'Share'}</span>
          </button>

          <Link
            href={`/watch/${video.id}`}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
            aria-label="Open full watch page"
            title="Open full watch page"
          >
            <Icon name="open_in_full" />
          </Link>
        </div>
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
      {commentsOpen ? (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/50">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close comments"
            onClick={() => setCommentsOpen(false)}
          />
          <div className="relative max-h-[70%] overflow-y-auto rounded-t-2xl bg-surface p-4 text-on-surface shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Comments</h2>
              <button
                type="button"
                className="rounded-full p-2 hover:bg-surface-container-high"
                aria-label="Close"
                onClick={() => setCommentsOpen(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <CommentsPanel
              videoId={video.id}
              videoOwnerId={video.userId}
              commentCount={video.commentCount}
              onGuestInteract={onGuestAction}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ShortsFeed() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [guestGate, setGuestGate] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  const query = useInfiniteQuery({
    queryKey: ['shorts-feed'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '12' });
      if (pageParam) params.set('cursor', pageParam);
      const { data } = await api.get<{ data: ShortsPage }>(`/videos/shorts?${params.toString()}`);
      return data.data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const videos = (query.data?.pages.flatMap((p) => p.data) ?? []).filter((v) => !hiddenIds.has(v.id));

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || videos.length === 0) return;
    const index = Math.round(el.scrollTop / el.clientHeight);
    setActiveIndex(Math.max(0, Math.min(index, videos.length - 1)));
    if (index >= videos.length - 3 && query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [videos.length, query]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const el = scrollerRef.current;
      if (!el) return;
      const key = e.key.toLowerCase();
      if (key === 'arrowdown') {
        e.preventDefault();
        el.scrollBy({ top: el.clientHeight, behavior: 'smooth' });
      } else if (key === 'arrowup') {
        e.preventDefault();
        el.scrollBy({ top: -el.clientHeight, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (query.isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="aspect-[9/16] h-full max-h-full w-full max-w-[420px] animate-pulse rounded-2xl bg-surface-container-high" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <EmptyState
        icon="error"
        title="Couldn't load Shorts"
        description="Try again in a moment."
        action={{ label: 'Retry', href: '/shorts' }}
        onAction={() => query.refetch()}
      />
    );
  }

  if (!videos.length) {
    return (
      <EmptyState
        icon="smart_display"
        title="No Shorts yet"
        description="Short videos will show up here when creators publish them."
        action={{ label: 'Go home', href: '/' }}
      />
    );
  }

  return (
    <div className="relative">
      <Link
        href="/"
        className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high/80 text-on-surface backdrop-blur-sm hover:bg-surface-container-highest"
        aria-label="Back to home"
      >
        <Icon name="arrow_back" />
      </Link>
      <div
        ref={scrollerRef}
        className="hide-scrollbar mx-auto flex h-dvh max-w-[480px] flex-col overflow-y-auto snap-y snap-mandatory"
        role="feed"
        aria-label="Shorts"
      >
        {videos.map((video, i) => (
          <ShortSlide
            key={video.id}
            video={video}
            active={i === activeIndex}
            onGuestAction={() => setGuestGate(true)}
            onHidden={(id) => setHiddenIds((prev) => new Set(prev).add(id))}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 gap-2 md:flex">
        <IconButton
          icon="keyboard_arrow_up"
          label="Previous Short"
          className="pointer-events-auto bg-surface-container-high/80"
          onClick={() => {
            const el = scrollerRef.current;
            if (!el) return;
            el.scrollBy({ top: -el.clientHeight, behavior: 'smooth' });
          }}
        />
        <IconButton
          icon="keyboard_arrow_down"
          label="Next Short"
          className="pointer-events-auto bg-surface-container-high/80"
          onClick={() => {
            const el = scrollerRef.current;
            if (!el) return;
            el.scrollBy({ top: el.clientHeight, behavior: 'smooth' });
          }}
        />
      </div>
      <AuthGateModal
        open={guestGate}
        onClose={() => setGuestGate(false)}
        message="Sign in to like and subscribe on Shorts."
      />
    </div>
  );
}
