'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, FeedGridSkeleton, PageHeader, Icon } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ContinueWatching } from '@/components/ContinueWatching';
import { FeedCard } from '@/components/FeedCard/FeedCard';
import { Video, Playlist } from '@/types';

type PlaylistSort = 'recent' | 'az' | 'za';

export default function LibraryPage() {
  const { user, isGuest } = useAuth();
  const [playlistSort, setPlaylistSort] = useState<PlaylistSort>('recent');

  const historyQuery = useQuery({
    queryKey: ['watch-history', 'library', user?.id],
    enabled: !isGuest && !!user,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { data: { video: Video; progressSeconds: number }[] };
      }>('/users/me/watch-history');
      return data.data.data;
    },
  });

  const playlistsQuery = useQuery({
    queryKey: ['my-playlists', user?.id],
    enabled: !isGuest && !!user,
    queryFn: async () => {
      try {
        const { data } = await api.get<{ data: Playlist[] }>('/playlists/me');
        return data.data;
      } catch {
        return [] as Playlist[];
      }
    },
  });

  const watchLater = playlistsQuery.data?.find((p) => p.systemType === 'watch_later');
  const likedVideos = playlistsQuery.data?.find((p) => p.systemType === 'liked');
  const userPlaylists = useMemo(() => {
    const list = playlistsQuery.data?.filter((p) => !p.systemType) ?? [];
    if (playlistSort === 'az') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (playlistSort === 'za') {
      return [...list].sort((a, b) => b.title.localeCompare(a.title));
    }
    return list;
  }, [playlistsQuery.data, playlistSort]);

  if (isGuest) {
    return (
      <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
        <PageHeader title="You" subtitle="History, playlists, and saved videos" />
        <EmptyState
          icon="login"
          title="Sign in to view your library"
          description="Your watch history, Watch later, and playlists are saved to your account."
          action={{ label: 'Sign in', href: '/login?next=/library' }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={user?.username ? `/${user.username}` : '/profile'}
            className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-surface-container-high"
            aria-label="Your channel"
          >
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Icon name="person" className="text-2xl text-on-surface-variant" />
            )}
          </Link>
          <div>
            <PageHeader title="You" subtitle={user?.displayName ?? 'Your library'} />
            <Link
              href={user?.username ? `/${user.username}` : '/profile'}
              className="text-sm text-primary hover:underline"
            >
              View channel
            </Link>
          </div>
        </div>
        <Link
          href="/playlists/new"
          className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-high"
        >
          New playlist
        </Link>
      </div>

      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/history"
          className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-4 hover:border-primary/30"
        >
          <Icon name="history" className="text-primary" />
          <span className="font-semibold">History</span>
        </Link>
        <Link
          href={watchLater ? `/playlists/${watchLater.id}` : '/playlists/me/watch-later'}
          className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-4 hover:border-primary/30"
        >
          <Icon name="watch_later" className="text-primary" />
          <span className="font-semibold">
            Watch later
            {typeof watchLater?.videoCount === 'number' ? (
              <span className="ml-2 text-xs font-normal text-on-surface-variant">
                {watchLater.videoCount}
              </span>
            ) : null}
          </span>
        </Link>
        <Link
          href={likedVideos ? `/playlists/${likedVideos.id}` : '/playlists/me/liked'}
          className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-4 hover:border-primary/30"
        >
          <Icon name="thumb_up" className="text-primary" />
          <span className="font-semibold">
            Liked videos
            {typeof likedVideos?.videoCount === 'number' ? (
              <span className="ml-2 text-xs font-normal text-on-surface-variant">
                {likedVideos.videoCount}
              </span>
            ) : null}
          </span>
        </Link>
        <Link
          href="/library/disliked"
          className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-4 hover:border-primary/30"
        >
          <Icon name="thumb_down" className="text-primary" />
          <span className="font-semibold">Disliked videos</span>
        </Link>
        {user?.username ? (
          <Link
            href={`/${user.username}?tab=videos`}
            className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-4 hover:border-primary/30"
          >
            <Icon name="video_library" className="text-primary" />
            <span className="font-semibold">Your videos</span>
          </Link>
        ) : (
          <Link
            href="/playlists/new"
            className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-4 hover:border-primary/30"
          >
            <Icon name="playlist_add" className="text-primary" />
            <span className="font-semibold">New playlist</span>
          </Link>
        )}
      </section>

      <section className="mb-12">
        <ContinueWatching />
      </section>

      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-label-caps text-outline">History</h2>
          <Link href="/history" className="text-sm text-primary hover:underline">
            See all
          </Link>
        </div>
        {historyQuery.isLoading ? (
          <FeedGridSkeleton count={4} />
        ) : historyQuery.isError ? (
          <EmptyState
            icon="error"
            title="Couldn't load history"
            description="Try again in a moment."
            action={{ label: 'Retry', href: '/library' }}
            onAction={() => historyQuery.refetch()}
          />
        ) : !historyQuery.data?.length ? (
          <EmptyState
            icon="history"
            title="No watch history"
            description="Videos you watch will appear here."
            action={{ label: 'Browse', href: '/' }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {historyQuery.data.slice(0, 8).map((item) => (
              <FeedCard key={item.video.id} video={item.video} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-label-caps text-outline">Playlists</h2>
          <div className="flex flex-wrap items-center gap-3">
            {userPlaylists.length > 1 ? (
              <label className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
                <span className="sr-only">Sort playlists</span>
                <select
                  value={playlistSort}
                  onChange={(e) => setPlaylistSort(e.target.value as PlaylistSort)}
                  className="rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1.5 text-sm"
                  aria-label="Sort playlists"
                >
                  <option value="recent">Recently added</option>
                  <option value="az">A–Z</option>
                  <option value="za">Z–A</option>
                </select>
              </label>
            ) : null}
            <Link href="/playlists/new" className="text-sm text-primary hover:underline">
              New playlist
            </Link>
          </div>
        </div>
        {playlistsQuery.isLoading ? (
          <ul className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="h-14 animate-pulse rounded-xl bg-surface-container-high" />
            ))}
          </ul>
        ) : !userPlaylists.length ? (
          <EmptyState
            icon="playlist_play"
            title="No playlists yet"
            description="Create playlists to organize videos you want to watch."
            action={{ label: 'Create playlist', href: '/playlists/new' }}
          />
        ) : (
          <ul className="space-y-2">
            {userPlaylists.map((pl) => {
              const visibilityLabel =
                pl.visibility === 'private'
                  ? 'Private'
                  : pl.visibility === 'unlisted'
                    ? 'Unlisted'
                    : 'Public';
              const count = pl.videoCount ?? pl.items?.length;
              return (
                <li key={pl.id}>
                  <Link
                    href={`/playlists/${pl.id}`}
                    className="glass-panel block rounded-xl px-4 py-3 hover:border-primary/30"
                  >
                    <p className="font-medium text-on-surface">{pl.title}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      {visibilityLabel}
                      {typeof count === 'number' ? ` · ${count} video${count === 1 ? '' : 's'}` : ''}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
