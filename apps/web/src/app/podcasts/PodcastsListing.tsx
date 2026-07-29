'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader, ListSkeleton } from '@forge/design-system';
import { api } from '@/lib/api';

type PodcastVideo = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
  playbackUrl?: string | null;
  user?: { displayName?: string; username?: string };
  createdAt: string;
};

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function PodcastsListing() {
  const { data, isLoading } = useQuery({
    queryKey: ['podcasts-library'],
    queryFn: async () => {
      const { data: res } = await api.get<{
        data: { data: PodcastVideo[]; meta?: unknown };
      }>('/content/library?types=podcast&limit=40&sort=latest');
      return res.data.data ?? [];
    },
  });

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <PageHeader
        title="Podcasts"
        subtitle="Skill-focused audio series from FORGE creators"
      />

      {isLoading ? (
        <div className="mt-8">
          <ListSkeleton count={6} />
        </div>
      ) : !data?.length ? (
        <div className="mt-12 text-center">
          <p className="text-lg text-on-surface-variant">No podcast episodes available yet.</p>
          <p className="mt-2 text-sm text-outline">
            Creators can publish podcast series from the Studio.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {data.map((ep) => (
            <li
              key={ep.id}
              className="glass-panel flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center"
            >
              {ep.thumbnailUrl ? (
                <img
                  src={ep.thumbnailUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-2xl text-outline">
                  🎙️
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{ep.title}</p>
                <p className="text-xs text-on-surface-variant">
                  {ep.user?.displayName ?? ep.user?.username ?? 'Creator'}
                  {ep.duration ? ` · ${formatDuration(ep.duration)}` : ''}
                </p>
              </div>
              {ep.playbackUrl ? (
                <audio controls preload="none" className="h-10 w-full sm:w-64 shrink-0">
                  <source src={ep.playbackUrl} />
                </audio>
              ) : (
                <span className="text-xs text-outline">No audio</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
