'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@forge/design-system';
import type { Playlist } from '@/types';
import { buildWatchListHref } from '@/lib/playlist-watch-prefs';

export function PlaylistQueueRail({
  playlist,
  currentVideoId,
  listId,
  shuffle = false,
}: {
  playlist: Playlist;
  currentVideoId: string;
  listId: string;
  shuffle?: boolean;
}) {
  const items = playlist.items ?? [];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-3">
        <p className="font-label-caps text-xs text-outline">Playlist</p>
        <Link
          href={`/playlists/${playlist.id}`}
          className="mt-1 block truncate font-medium text-on-surface hover:text-primary"
        >
          {playlist.title}
        </Link>
        <p className="mt-0.5 text-xs text-on-surface-variant">
          {items.length} videos
          {shuffle ? ' · Shuffle on' : ''}
        </p>
      </div>
      <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
        {items.map((item, index) => {
          const active = item.videoId === currentVideoId;
          const href = buildWatchListHref(item.videoId, listId, shuffle);
          return (
            <li key={item.id}>
              <Link
                href={href}
                className={`flex items-center gap-3 rounded-lg p-2 transition ${
                  active
                    ? 'bg-primary/15 ring-1 ring-primary/40'
                    : 'hover:bg-surface-container-high'
                }`}
                aria-current={active ? 'true' : undefined}
              >
                <span className="w-5 shrink-0 text-center text-xs text-outline">{index + 1}</span>
                <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded bg-surface-container-high">
                  {item.video?.thumbnailUrl ? (
                    <Image
                      src={item.video.thumbnailUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Icon name="play_circle" className="text-lg text-primary" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-on-surface">
                    {item.video?.title ?? 'Video'}
                  </p>
                  <p className="truncate text-xs text-on-surface-variant">
                    {item.video?.user?.displayName ?? 'Channel'}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
