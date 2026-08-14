'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Playlist } from '@/types';

export default function LikedVideosRedirectPage() {
  const router = useRouter();
  const { isGuest } = useAuth();

  const query = useQuery({
    queryKey: ['playlist-liked'],
    enabled: !isGuest,
    queryFn: async () => {
      const { data } = await api.get<{ data: Playlist }>('/playlists/me/liked');
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
          title="Sign in for Liked videos"
          description="Videos you like are saved to your account."
          action={{ label: 'Sign in', href: '/login?next=/playlists/me/liked' }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <PageHeader title="Liked videos" subtitle="Opening your playlist…" />
      {query.isError ? (
        <EmptyState
          icon="error"
          title="Couldn't open Liked videos"
          description="Try again in a moment."
          action={{ label: 'Library', href: '/library' }}
        />
      ) : null}
    </main>
  );
}
