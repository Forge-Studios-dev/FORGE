'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@forge/design-system';
import { Video } from '@/types';
import { formatCount, formatDuration, timeAgo } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { addToWatchLater } from '@/lib/engage-mutations';
import { trackVideoImpression } from '@/lib/analytics';
import { ReportContentButton } from '@/components/watch/ReportContentButton';
import { SaveToPlaylistModal } from '@/components/playlists/SaveToPlaylistModal';

export type FeedCardLayout = 'grid' | 'carousel' | 'sidebar';

interface Props {
  video: Video;
  layout?: FeedCardLayout;
  /** @deprecated use layout="carousel" */
  compact?: boolean;
  /** Called after a successful Not interested (home feed hide). */
  onNotInterested?: (videoId: string) => void;
  /** Called after muting the channel (hide all of their cards). */
  onDontRecommendChannel?: (channelId: string) => void;
}

const LAYOUT_CLASS: Record<FeedCardLayout, string> = {
  grid: 'w-full min-w-0',
  carousel: 'w-[280px] shrink-0 flex-none sm:w-[300px] md:w-[320px]',
  sidebar: 'w-full min-w-0 max-w-full',
};

function resolveLayout(compact?: boolean, layout?: FeedCardLayout): FeedCardLayout {
  if (layout) return layout;
  if (compact) return 'carousel';
  return 'grid';
}

function imageSizes(layout: FeedCardLayout): string {
  if (layout === 'carousel') return '(max-width: 640px) 280px, (max-width: 768px) 300px, 320px';
  if (layout === 'sidebar') return '(max-width: 1024px) 100vw, 360px';
  return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw';
}

export function FeedCard({
  video,
  compact,
  layout: layoutProp,
  onNotInterested,
  onDontRecommendChannel,
}: Props) {
  const layout = resolveLayout(compact, layoutProp);
  const compactMeta = layout === 'carousel' || layout === 'sidebar';
  const creatorName = video.user?.displayName ?? 'Creator';
  const creatorInitial = creatorName[0] ?? '?';
  const { isGuest } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [watchLaterSaved, setWatchLaterSaved] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const progress = video.viewerProgressSeconds;
  const progressPct =
    progress != null &&
    progress > 0 &&
    video.durationSeconds &&
    video.durationSeconds > 0
      ? Math.min(100, Math.round((progress / video.durationSeconds) * 100))
      : null;
  const watchHref =
    progress != null && progress > 5
      ? `/watch/${video.id}?t=${Math.floor(progress)}`
      : `/watch/${video.id}`;
  const channelHref = video.user?.username ? `/${video.user.username}` : null;
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) {
          trackVideoImpression(video.id, layout);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [video.id, layout]);

  const showMenu = !isGuest && (layout === 'grid' || layout === 'sidebar' || layout === 'carousel');

  const hideVideo = async () => {
    if (!onNotInterested || pending) return;
    setPending(true);
    try {
      await api.post(`/videos/${video.id}/not-interested`);
      onNotInterested(video.id);
    } catch {
      /* keep card visible on failure */
    } finally {
      setPending(false);
      setMenuOpen(false);
    }
  };

  const muteChannel = async () => {
    if (!onDontRecommendChannel || pending) return;
    setPending(true);
    try {
      await api.post(`/videos/${video.id}/dont-recommend-channel`);
      onDontRecommendChannel(video.userId);
    } catch {
      /* keep card visible on failure */
    } finally {
      setPending(false);
      setMenuOpen(false);
    }
  };

  const saveWatchLater = async () => {
    if (pending || watchLaterSaved) return;
    setPending(true);
    try {
      await addToWatchLater(video.id);
      setWatchLaterSaved(true);
    } catch {
      /* ignore */
    } finally {
      setPending(false);
      setMenuOpen(false);
    }
  };

  const copyLink = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}${watchHref}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
    setMenuOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${LAYOUT_CLASS[layout]}`}>
      <Link
        href={watchHref}
        className="forge-card-hover group block cursor-pointer"
      >
        <div className="border-subtle relative aspect-video w-full overflow-hidden rounded-xl border bg-surface-container-highest transition-colors group-hover:border-primary/50">
          {video.thumbnailUrl ? (
            <Image
              src={video.thumbnailUrl}
              alt={video.title}
              fill
              className="object-cover opacity-90 transition-opacity group-hover:opacity-100"
              sizes={imageSizes(layout)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-container-high text-on-surface-variant">
              <Icon name="movie" className="text-4xl" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 text-on-primary shadow-lg">
              <Icon name="play_arrow" className="text-3xl" />
            </span>
          </div>
          {video.durationSeconds ? (
            <span className="font-label-caps absolute bottom-3 right-3 rounded bg-background/80 px-2 py-0.5 text-[10px] text-on-surface">
              {formatDuration(video.durationSeconds)}
            </span>
          ) : null}
          {progressPct != null ? (
            <div
              className="absolute inset-x-0 bottom-0 h-1 bg-on-surface/40"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${progressPct}% watched`}
            >
              <div className="h-full bg-primary" style={{ width: `${progressPct}%` }} />
            </div>
          ) : null}
        </div>

        <div className="mt-3 min-w-0 pr-8">
          <h3 className="font-display-forge line-clamp-2 text-sm font-semibold text-on-surface group-hover:text-primary">
            {video.title}
          </h3>
        </div>
      </Link>

      {!compactMeta ? (
        <div className="mt-2 flex min-w-0 items-center gap-2 pr-8">
          {channelHref ? (
            <Link href={channelHref} className="flex min-w-0 items-center gap-2 hover:opacity-90">
              {video.user?.avatarUrl ? (
                <Image
                  src={video.user.avatarUrl}
                  alt=""
                  width={20}
                  height={20}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary">
                  {creatorInitial}
                </div>
              )}
              <span className="truncate text-xs text-on-surface-variant hover:text-on-surface">
                {creatorName}
              </span>
            </Link>
          ) : (
            <>
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary">
                {creatorInitial}
              </div>
              <span className="truncate text-xs text-on-surface-variant">{creatorName}</span>
            </>
          )}
        </div>
      ) : null}
      {!compactMeta ? (
        <div className="mt-1.5 flex items-center gap-3 pr-8 text-xs text-outline">
          <span>{formatCount(video.viewCount)} views</span>
          <span>·</span>
          <span>{timeAgo(video.createdAt)}</span>
        </div>
      ) : null}
      {compactMeta ? (
        <p className="mt-1 truncate pr-8 text-sm text-on-surface-variant">
          {channelHref ? (
            <Link href={channelHref} className="hover:text-on-surface hover:underline">
              {creatorName}
            </Link>
          ) : (
            creatorName
          )}
          {video.viewCount ? ` · ${formatCount(video.viewCount)} views` : ''}
        </p>
      ) : null}

      {showMenu ? (
        <div
          className={
            layout === 'sidebar'
              ? 'absolute right-0 top-2 z-10'
              : 'absolute right-0 top-[calc(56.25%+0.75rem)] z-10'
          }
        >
          <button
            type="button"
            aria-label="More options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            className="rounded-full p-1.5 text-on-surface-variant opacity-80 hover:bg-surface-container-high hover:text-on-surface"
          >
            <Icon name="more_vert" className="text-xl" />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 min-w-[220px] rounded-xl border border-outline-variant/30 bg-surface-container-high p-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={pending || watchLaterSaved}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void saveWatchLater();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container disabled:opacity-60"
                >
                  <Icon name="watch_later" className="text-base" />
                  {watchLaterSaved ? 'Saved to Watch later' : 'Save to Watch later'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(false);
                    setSaveOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container"
                >
                  <Icon name="playlist_add" className="text-base" />
                  Save to playlist
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void copyLink();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container"
                >
                  <Icon name="link" className="text-base" />
                  Copy link
                </button>
                <div
                  role="menuitem"
                  className="rounded-lg px-3 py-2 hover:bg-surface-container"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <ReportContentButton
                    targetType="video"
                    targetId={video.id}
                    className="flex w-full items-center gap-2 text-left text-sm text-on-surface"
                  />
                </div>
                {onNotInterested ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={pending}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void hideVideo();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container disabled:opacity-60"
                  >
                    <Icon name="visibility_off" className="text-base" />
                    {pending ? 'Hiding…' : 'Not interested'}
                  </button>
                ) : null}
                {onDontRecommendChannel ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={pending}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void muteChannel();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container disabled:opacity-60"
                  >
                    <Icon name="block" className="text-base" />
                    Don’t recommend channel
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <SaveToPlaylistModal
        videoId={video.id}
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
      />
    </div>
  );
}
