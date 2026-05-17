'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ContinueWatching } from '@/components/ContinueWatching';
import { FeedCard } from '@/components/FeedCard/FeedCard';
import { EmptyState } from '@/components/EmptyState';
import { FeedGridSkeleton } from '@/components/LoadingSkeleton';
import { Video, Playlist } from '@/types';

export default function LibraryPage() {
  const { user, isGuest } = useAuth();

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

  if (isGuest) {
    return (
      <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
        <PageHeader title="Library" subtitle="Continue learning and saved collections" />
        <EmptyState
          icon="login"
          title="Sign in to view your library"
          description="Your watch history and playlists are saved to your account."
          action={{ label: 'Sign in', href: '/login?next=/library' }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <PageHeader title="Library" subtitle="Continue learning and saved collections" />

      <section className="mb-12">
        <ContinueWatching />
      </section>

      <section className="mb-12">
        <h2 className="font-label-caps mb-4 text-outline">Watch history</h2>
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
            description="Lessons you start will appear here."
            action={{ label: 'Explore skills', href: '/explore' }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {historyQuery.data.map((item) => (
              <FeedCard key={item.video.id} video={item.video} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-label-caps text-outline">Playlists</h2>
          <Link href="/playlists/new" className="text-sm text-primary hover:underline">
            New playlist
          </Link>
        </div>
        {playlistsQuery.isLoading ? (
          <ul className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="h-14 animate-pulse rounded-xl bg-surface-container-high" />
            ))}
          </ul>
        ) : !playlistsQuery.data?.length ? (
          <EmptyState
            icon="playlist_play"
            title="No playlists yet"
            description="Save lessons into collections for focused learning."
            action={{ label: 'Create playlist', href: '/playlists/new' }}
          />
        ) : (
          <ul className="space-y-2">
            {playlistsQuery.data.map((pl) => (
              <li key={pl.id}>
                <Link
                  href={`/playlists/${pl.id}`}
                  className="glass-panel block rounded-xl px-4 py-3 hover:border-primary/30"
                >
                  {pl.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
