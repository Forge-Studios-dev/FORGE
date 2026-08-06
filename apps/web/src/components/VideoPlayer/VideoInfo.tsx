'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Icon } from '@forge/design-system';
import { Video } from '@/types';
import { formatCount, timeAgo } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { AuthGateModal } from '@/components/gates/AuthGateModal';
import { VerifyEmailGateModal } from '@/components/gates/VerifyEmailGateModal';
import {
  engageBlockedMessage,
  getEngageBlockReason,
  type EngageBlockReason,
} from '@/lib/engage-access';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-message';
import {
  engageErrorReason,
  isInWatchLater,
  toggleVideoDislike,
  toggleVideoLike,
  toggleWatchLater,
} from '@/lib/engage-mutations';
import { SubscribeChannelControl } from '@/components/SubscribeChannelControl/SubscribeChannelControl';
import { SaveToPlaylistModal } from '@/components/playlists/SaveToPlaylistModal';
import { splitDescriptionTimestamps } from '@/lib/description-timestamps';
import { buildWatchShareUrl } from '@/lib/watch-url';

interface Props {
  video: Video;
  onGuestAction?: () => void;
  /** Seek player when a description timestamp is clicked. */
  onSeekTo?: (seconds: number) => void;
  /** Current playback position for “copy link at time”. */
  playbackSeconds?: number;
  /** Active playlist id when watching from a list. */
  listId?: string | null;
}

export function VideoInfo({
  video,
  onGuestAction,
  onSeekTo,
  playbackSeconds = 0,
  listId = null,
}: Props) {
  const qc = useQueryClient();
  const { user: me, isGuest } = useAuth();
  const [descExpanded, setDescExpanded] = useState(false);
  const [liked, setLiked] = useState(!!video.viewerLiked);
  const [disliked, setDisliked] = useState(!!video.viewerDisliked);
  const [likeCount, setLikeCount] = useState(video.likeCount);
  const [engageBlock, setEngageBlock] = useState<EngageBlockReason | null>(null);
  const [engageError, setEngageError] = useState<string | null>(null);
  const [inWatchLater, setInWatchLater] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [thanksOpen, setThanksOpen] = useState(false);
  const [thanksAmount, setThanksAmount] = useState('2');
  const [thanksMessage, setThanksMessage] = useState('');
  const [thanksPending, setThanksPending] = useState(false);
  const [thanksHint, setThanksHint] = useState<string | null>(null);
  const blockReason = onGuestAction ? null : getEngageBlockReason(me, isGuest);

  useEffect(() => {
    setLiked(!!video.viewerLiked);
    setDisliked(!!video.viewerDisliked);
    setLikeCount(video.likeCount);
  }, [video.viewerLiked, video.viewerDisliked, video.likeCount]);

  useEffect(() => {
    if (isGuest || !me) {
      setInWatchLater(false);
      return;
    }
    let cancelled = false;
    void isInWatchLater(video.id)
      .then((saved) => {
        if (!cancelled) setInWatchLater(saved);
      })
      .catch(() => {
        if (!cancelled) setInWatchLater(false);
      });
    return () => {
      cancelled = true;
    };
  }, [video.id, isGuest, me]);

  const likeMutation = useMutation({
    mutationFn: async (nextLiked: boolean) => {
      if (nextLiked) {
        await toggleVideoLike(video.id, false);
      } else {
        await toggleVideoLike(video.id, true);
      }
    },
    onMutate: (nextLiked) => {
      setEngageError(null);
      const wasLiked = liked;
      const wasDisliked = disliked;
      setLiked(nextLiked);
      if (nextLiked && wasDisliked) setDisliked(false);
      setLikeCount((c) => {
        if (nextLiked && !wasLiked) return c + 1;
        if (!nextLiked && wasLiked) return Math.max(0, c - 1);
        return c;
      });
    },
    onError: (err) => {
      setLiked(!!video.viewerLiked);
      setDisliked(!!video.viewerDisliked);
      setLikeCount(video.likeCount);
      const reason = engageErrorReason(err);
      if (reason === 'guest' || reason === 'unverified') {
        setEngageBlock(reason);
      } else {
        setEngageError('Could not update like. Try again.');
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['video', video.id] }),
  });

  const dislikeMutation = useMutation({
    mutationFn: async (nextDisliked: boolean) => {
      if (nextDisliked) {
        await toggleVideoDislike(video.id, false);
      } else {
        await toggleVideoDislike(video.id, true);
      }
    },
    onMutate: (nextDisliked) => {
      setEngageError(null);
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
      setLikeCount(video.likeCount);
      const reason = engageErrorReason(err);
      if (reason === 'guest' || reason === 'unverified') {
        setEngageBlock(reason);
      } else {
        setEngageError('Could not update dislike. Try again.');
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['video', video.id] }),
  });

  const watchLaterMutation = useMutation({
    mutationFn: (nextSaved: boolean) => toggleWatchLater(video.id, !nextSaved),
    onMutate: (nextSaved) => {
      setEngageError(null);
      setInWatchLater(nextSaved);
    },
    onError: (err, nextSaved) => {
      setInWatchLater(!nextSaved);
      const reason = engageErrorReason(err);
      if (reason === 'guest' || reason === 'unverified') {
        setEngageBlock(reason);
      } else {
        setEngageError('Could not update Watch later.');
      }
    },
  });

  const saveToPlaylist = () => {
    setSaveOpen(true);
  };

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

  const handleShare = async (atCurrentTime = false) => {
    const url = buildWatchShareUrl({
      videoId: video.id,
      seconds: atCurrentTime ? playbackSeconds : null,
      listId,
      videoType: video.videoType,
    });
    setShareHint(null);
    if (!atCurrentTime && navigator.share) {
      try {
        await navigator.share({ title: video.title, url });
        return;
      } catch {
        /* user cancelled or fallback to clipboard */
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setShareHint(atCurrentTime ? 'Link copied at current time' : 'Link copied');
      setTimeout(() => setShareHint(null), 2000);
    }
  };

  const handleCopyEmbed = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const src = `${origin}/embed/${video.id}`;
    const snippet = `<iframe width="560" height="315" src="${src}" title="${video.title.replace(/"/g, '')}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    setShareHint(null);
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(snippet);
      setShareHint('Embed code copied');
      setTimeout(() => setShareHint(null), 2000);
    }
  };

  const THANKS_PRESETS = [100, 200, 500, 1000, 2000] as const;

  const sendThanks = async () => {
    const dollars = Number.parseFloat(thanksAmount);
    if (!Number.isFinite(dollars) || dollars < 1) {
      setThanksHint('Minimum Super Thanks is $1');
      return;
    }
    const amountCents = Math.round(dollars * 100);
    setThanksPending(true);
    setThanksHint(null);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const watchPath = typeof window !== 'undefined' ? window.location.pathname : `/watch/${video.id}`;
      const { data } = await api.post<{
        data?: {
          requiresCheckout?: boolean;
          checkoutUrl?: string | null;
          tipped?: boolean;
        };
        requiresCheckout?: boolean;
        checkoutUrl?: string | null;
        tipped?: boolean;
      }>('/billing/checkout/super-thanks', {
        videoId: video.id,
        amountCents,
        body: thanksMessage.trim() || undefined,
        successUrl: `${origin}${watchPath}?thanks=1`,
        cancelUrl: `${origin}${watchPath}`,
      });
      const payload = data.data ?? data;
      if (payload.requiresCheckout && payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }
      setThanksHint('Thanks sent!');
      setThanksOpen(false);
      setThanksMessage('');
      setTimeout(() => setThanksHint(null), 3000);
    } catch (err) {
      setThanksHint(getApiErrorMessage(err, 'Could not send Super Thanks'));
    } finally {
      setThanksPending(false);
    }
  };

  const creator = video.user;
  const creatorName = creator?.displayName ?? 'Creator';
  const creatorUsername = creator?.username ?? 'creator';
  const subscriberCount = creator?.subscriberCount ?? creator?.followerCount ?? 0;
  const description = video.description?.trim() ?? '';
  const descLong = description.length > 280;
  const descPreview = descLong && !descExpanded ? `${description.slice(0, 280)}…` : description;
  const isOwnVideo = !!me?.id && me.id === video.userId;

  return (
    <div className="space-y-4">
      <h1 className="font-display-forge text-2xl font-bold tracking-tight md:text-3xl">{video.title}</h1>

      {video.sourceStreamId ? (
        <Link
          href={`/live/${video.sourceStreamId}`}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Icon name="live_tv" className="text-base" />
          Recorded from a live stream
        </Link>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/20 pb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Link href={`/${creatorUsername}`} className="flex items-center gap-3 transition hover:opacity-90">
            {creator?.avatarUrl ? (
              <Image
                src={creator.avatarUrl}
                alt={creatorName}
                width={48}
                height={48}
                className="rounded-full border border-outline-variant/30 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-outline-variant/30 bg-primary-container font-bold text-on-primary">
                {creatorName[0]}
              </div>
            )}
            <div>
              <p className="font-medium text-on-surface">{creatorName}</p>
              <p className="font-label-caps mt-0.5 text-on-surface-variant">
                {formatCount(subscriberCount)} subscribers
              </p>
            </div>
          </Link>
          {!isOwnVideo && (
            <SubscribeChannelControl
              channelId={video.userId}
              initialSubscribed={!!(video.viewerSubscribed ?? video.viewerFollowingCreator)}
              onGuestAction={onGuestAction}
              onEngageBlock={setEngageBlock}
              onEngageError={(msg) => {
                setEngageError(msg);
              }}
              className="ml-2"
            />
          )}
        </div>

        <div className="flex items-center gap-1 rounded-full border border-outline-variant/20 bg-surface-container-low p-1">
          <button
            type="button"
            disabled={likeMutation.isPending || dislikeMutation.isPending}
            onClick={() => gated(() => likeMutation.mutate(!liked))}
            className={`group flex items-center gap-2 rounded-full px-4 py-2 transition hover:bg-surface-container-high ${
              liked ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            aria-pressed={liked}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <Icon
              name="thumb_up"
              filled={liked}
              className={`text-base ${liked ? 'text-primary' : 'group-hover:text-primary'}`}
            />
            <span className="font-label-caps">{formatCount(likeCount)}</span>
          </button>
          <div className="h-6 w-px bg-outline-variant/30" />
          <button
            type="button"
            disabled={likeMutation.isPending || dislikeMutation.isPending}
            onClick={() => gated(() => dislikeMutation.mutate(!disliked))}
            className={`group flex items-center gap-2 rounded-full px-3 py-2 transition hover:bg-surface-container-high ${
              disliked ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            aria-pressed={disliked}
            aria-label={disliked ? 'Remove dislike' : 'Dislike'}
          >
            <Icon name="thumb_down" filled={disliked} className="text-base" />
          </button>
          <div className="h-6 w-px bg-outline-variant/30" />
          <button
            type="button"
            disabled={watchLaterMutation.isPending}
            onClick={() => gated(() => watchLaterMutation.mutate(!inWatchLater))}
            className={`group flex items-center gap-2 rounded-full px-4 py-2 transition hover:bg-surface-container-high ${
              inWatchLater ? 'text-secondary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            aria-pressed={inWatchLater}
            aria-label={inWatchLater ? 'Remove from Watch later' : 'Save to Watch later'}
          >
            <Icon
              name="watch_later"
              filled={inWatchLater}
              className={`text-base ${inWatchLater ? 'text-secondary' : 'group-hover:text-secondary'}`}
            />
          </button>
          <button
            type="button"
            onClick={() => gated(() => saveToPlaylist())}
            className="group flex items-center gap-2 rounded-full px-4 py-2 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
            aria-haspopup="dialog"
            aria-label="Save to playlist"
          >
            <Icon name="playlist_add" className="text-base group-hover:text-secondary" />
            <span className="font-label-caps">Save</span>
          </button>
          {!isOwnVideo ? (
            <button
              type="button"
              onClick={() => gated(() => setThanksOpen((v) => !v))}
              className="group flex items-center gap-2 rounded-full px-4 py-2 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
              aria-expanded={thanksOpen}
              aria-label="Super Thanks"
            >
              <Icon name="volunteer_activism" className="text-base group-hover:text-warning" />
              <span className="font-label-caps">Thanks</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleShare(false)}
            className="group flex items-center gap-2 rounded-full px-4 py-2 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Share"
          >
            <Icon name="share" className="text-base group-hover:text-tertiary" />
          </button>
          <button
            type="button"
            onClick={() => void handleShare(true)}
            className="group flex items-center gap-2 rounded-full px-4 py-2 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Copy link at current time"
            title="Copy link at current time"
          >
            <Icon name="schedule" className="text-base group-hover:text-tertiary" />
            <span className="font-label-caps hidden sm:inline">At time</span>
          </button>
          <button
            type="button"
            onClick={() => void handleCopyEmbed()}
            className="group flex items-center gap-2 rounded-full px-4 py-2 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Copy embed code"
            title="Copy embed code"
          >
            <Icon name="code" className="text-base group-hover:text-tertiary" />
            <span className="font-label-caps hidden sm:inline">Embed</span>
          </button>
        </div>
      </div>

      {thanksOpen && !isOwnVideo ? (
        <div className="glass-panel space-y-3 rounded-xl p-4" role="dialog" aria-label="Super Thanks">
          <p className="text-sm text-on-surface-variant">
            Send Super Thanks to {creatorName} (USD).
          </p>
          <div className="flex flex-wrap gap-2">
            {THANKS_PRESETS.map((cents) => (
              <button
                key={cents}
                type="button"
                onClick={() => setThanksAmount(String(cents / 100))}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  Number(thanksAmount) === cents / 100
                    ? 'bg-warning text-on-warning'
                    : 'border border-outline-variant/40 text-on-surface-variant hover:border-warning/60'
                }`}
              >
                ${(cents / 100).toFixed(0)}
              </button>
            ))}
          </div>
          <label className="block text-sm">
            <span className="font-label-caps text-xs text-outline">Custom amount ($)</span>
            <input
              type="number"
              min={1}
              max={1000}
              step={0.01}
              value={thanksAmount}
              onChange={(e) => setThanksAmount(e.target.value)}
              className="mt-1 w-full max-w-[12rem] rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm"
            />
          </label>
          <input
            value={thanksMessage}
            onChange={(e) => setThanksMessage(e.target.value)}
            placeholder="Optional message…"
            maxLength={200}
            className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={thanksPending}
              onClick={() => void sendThanks()}
              className="rounded-full bg-warning px-4 py-2 text-sm font-semibold text-on-warning disabled:opacity-50"
            >
              {thanksPending ? 'Sending…' : `Send $${Number(thanksAmount) || 0}`}
            </button>
            <button
              type="button"
              onClick={() => setThanksOpen(false)}
              className="rounded-full px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {shareHint || thanksHint ? (
        <p className="text-sm text-secondary" role="status">
          {thanksHint ?? shareHint}
        </p>
      ) : null}
      {engageError ? (
        <p className="text-sm text-error" role="alert">
          {engageError}
        </p>
      ) : null}

      {(description || (video.skillTags?.length ?? 0) > 0) && (
        <div className="glass-panel space-y-4 rounded-xl p-6">
          {video.skillTags && video.skillTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {video.skillTags.map((tag, i) => (
                <Link
                  key={tag.id}
                  href={`/search?q=${encodeURIComponent(`#${tag.name.replace(/\s+/g, '')}`)}`}
                  className={`font-label-caps rounded-full border px-3 py-1 hover:opacity-90 ${
                    i % 3 === 0
                      ? 'border-primary/20 bg-primary/10 text-primary'
                      : i % 3 === 1
                        ? 'border-secondary/20 bg-secondary/10 text-secondary'
                        : 'border-outline-variant/30 bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  #{tag.name.replace(/\s+/g, '')}
                </Link>
              ))}
            </div>
          )}
          {description && (
            <>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
                {splitDescriptionTimestamps(descPreview).map((seg, i) =>
                  seg.type === 'timestamp' && onSeekTo ? (
                    <button
                      key={`${seg.value}-${i}`}
                      type="button"
                      onClick={() => onSeekTo(seg.seconds)}
                      className="font-medium text-primary hover:underline"
                    >
                      {seg.value}
                    </button>
                  ) : seg.type === 'hashtag' ? (
                    <Link
                      key={`${seg.value}-${i}`}
                      href={`/search?q=${encodeURIComponent(seg.query)}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {seg.value}
                    </Link>
                  ) : (
                    <span key={`${i}-${seg.value.slice(0, 8)}`}>{seg.value}</span>
                  ),
                )}
              </p>
              {descLong && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((e) => !e)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {descExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-outline">
        <span className="flex items-center gap-1">
          <Icon name="visibility" className="text-sm" />
          {formatCount(video.viewCount)} views
        </span>
        <span className="flex items-center gap-1">
          <Icon name="chat_bubble" className="text-sm" />
          {formatCount(video.commentCount)} comments
        </span>
        <span>{timeAgo(video.createdAt)}</span>
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
      <SaveToPlaylistModal
        videoId={video.id}
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
      />
    </div>
  );
}
