'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Playlist } from '@/types';

export default function WatchLaterRedirectPage() {
  const router = useRouter();
  const { isGuest } = useAuth();

  const query = useQuery({
    queryKey: ['playlist-watch-later'],
    enabled: !isGuest,
    queryFn: async () => {
      const { data } = await api.get<{ data: Playlist }>('/playlists/me/watch-later');
      return data.data;
    },
  });

  useEffect(() => {
    if (query.data?.id) {
      router.replace(`/playlists/${query.data.id}`);
    }
  }, [query.data?.id, router]);

  if (isGuest) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <EmptyState
          icon="login"
          title="Sign in for Watch later"
          description="Save videos to watch later on your account."
          action={{ label: 'Sign in', href: '/login?next=/playlists/me/watch-later' }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <PageHeader title="Watch later" subtitle="Opening your playlist…" />
      {query.isError ? (
        <EmptyState
          icon="error"
          title="Couldn't open Watch later"
          description="Try again in a moment."
          action={{ label: 'Library', href: '/library' }}
        />
      ) : null}
    </main>
  );
}
