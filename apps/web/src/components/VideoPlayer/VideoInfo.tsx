'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Icon } from '@forge/design-system';
import { Video } from '@/types';
import { api } from '@/lib/api';
import { formatCount, timeAgo } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface Props {
  video: Video;
  onGuestAction?: () => void;
}

export function VideoInfo({ video, onGuestAction }: Props) {
  const qc = useQueryClient();
  const router = useRouter();
  const [descExpanded, setDescExpanded] = useState(false);
  const [following, setFollowing] = useState(false);

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/videos/${video.id}/like`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['video', video.id] }),
  });

  const followMutation = useMutation({
    mutationFn: () => api.post(`/follow/${video.userId}`),
    onSuccess: () => setFollowing(true),
  });

  const saveToPlaylist = useMutation({
    mutationFn: async () => {
      router.push(`/playlists/new?videoId=${video.id}`);
    },
  });

  const gated = (action: () => void) => {
    if (onGuestAction) {
      onGuestAction();
      return;
    }
    action();
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({ title: video.title, url });
      } catch {
        /* user cancelled */
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  };

  const creator = video.user;
  const creatorName = creator?.displayName ?? 'Creator';
  const creatorUsername = creator?.username ?? 'creator';
  const creatorFollowers = creator?.followerCount ?? 0;
  const description = video.description?.trim() ?? '';
  const descLong = description.length > 280;
  const descPreview = descLong && !descExpanded ? `${description.slice(0, 280)}…` : description;

  return (
    <div className="space-y-4">
      <h1 className="font-display-forge text-2xl font-bold tracking-tight md:text-3xl">{video.title}</h1>

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
                {formatCount(creatorFollowers)} subscribers
              </p>
            </div>
          </Link>
          {!onGuestAction && (
            <button
              type="button"
              disabled={followMutation.isPending || following}
              onClick={() => gated(() => followMutation.mutate())}
              className="primary-button ml-2 rounded-full px-6 py-2 text-sm font-semibold text-on-primary disabled:opacity-60"
            >
              {following ? 'Following' : 'Follow'}
            </button>
          )}
          {onGuestAction && (
            <button
              type="button"
              onClick={onGuestAction}
              className="primary-button ml-2 rounded-full px-6 py-2 text-sm font-semibold text-on-primary"
            >
              Follow
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-full border border-outline-variant/20 bg-surface-container-low p-1">
          <button
            type="button"
            onClick={() => gated(() => likeMutation.mutate())}
            className="group flex items-center gap-2 rounded-full px-4 py-2 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
          >
            <Icon name="thumb_up" className="text-base group-hover:text-primary" />
            <span className="font-label-caps">{formatCount(video.likeCount)}</span>
          </button>
          <div className="h-6 w-px bg-outline-variant/30" />
          <button
            type="button"
            onClick={() => gated(() => saveToPlaylist.mutate())}
            className="group flex items-center gap-2 rounded-full px-4 py-2 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
          >
            <Icon name="bookmark" className="text-base group-hover:text-secondary" />
            <span className="font-label-caps">Save</span>
          </button>
          <button
            type="button"
            onClick={() => gated(() => void handleShare())}
            className="group flex items-center gap-2 rounded-full px-4 py-2 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
          >
            <Icon name="share" className="text-base group-hover:text-tertiary" />
          </button>
        </div>
      </div>

      {(description || (video.skillTags?.length ?? 0) > 0) && (
        <div className="glass-panel space-y-4 rounded-xl p-6">
          {video.skillTags && video.skillTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {video.skillTags.map((tag, i) => (
                <span
                  key={tag.id}
                  className={`font-label-caps rounded-full border px-3 py-1 ${
                    i % 3 === 0
                      ? 'border-primary/20 bg-primary/10 text-primary'
                      : i % 3 === 1
                        ? 'border-secondary/20 bg-secondary/10 text-secondary'
                        : 'border-outline-variant/30 bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          {description && (
            <>
              <p className="text-sm leading-relaxed text-on-surface-variant">{descPreview}</p>
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
    </div>
  );
}
