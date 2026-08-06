'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { HorizontalCardSkeleton, Icon } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Video } from '@/types';
import { formatDuration } from '@/lib/utils';

function progressPct(video: Video): number | null {
  const progress = video.viewerProgressSeconds;
  if (
    progress == null ||
    progress <= 0 ||
    !video.durationSeconds ||
    video.durationSeconds <= 0
  ) {
    return null;
  }
  return Math.min(100, Math.round((progress / video.durationSeconds) * 100));
}

function watchHref(video: Video): string {
  const progress = video.viewerProgressSeconds;
  if (progress != null && progress > 5) {
    return `/watch/${video.id}?t=${Math.floor(progress)}`;
  }
  return `/watch/${video.id}`;
}

export function ContinueWatching() {
  const { user, isGuest, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['watch-history', 'continue', user?.id],
    enabled: !authLoading && !isGuest && !!user,
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: Video[] } }>(
        '/users/me/watch-history?incomplete=true&limit=12',
      );
      return (data.data.data ?? []).filter((v) => (v.viewerProgressSeconds ?? 0) >= 5);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (videoId: string) => api.delete(`/users/me/watch-history/${videoId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['watch-history'] });
    },
  });

  if (!user) return null;
  if (isLoading) {
    return (
      <section className="mb-10">
        <h2 className="font-display-forge mb-6 text-2xl font-semibold md:text-3xl">Continue watching</h2>
        <HorizontalCardSkeleton count={4} />
      </section>
    );
  }
  if (!data?.length) return null;

  return (
    <section id="continue" className="mb-12">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display-forge text-2xl font-semibold md:text-3xl">Continue watching</h2>
        <Link href="/history" className="font-label-caps text-secondary hover:underline">
          All history
        </Link>
      </div>
      <div className="hide-scrollbar -mx-5 flex gap-6 overflow-x-auto px-5 md:mx-0 md:px-0">
        {data.map((video) => {
          const pct = progressPct(video);
          const busy = removeMutation.isPending && removeMutation.variables === video.id;
          return (
            <article
              key={video.id}
              className="relative w-[280px] shrink-0 flex-none sm:w-[300px] md:w-[320px]"
            >
              <button
                type="button"
                disabled={busy}
                onClick={() => removeMutation.mutate(video.id)}
                className="absolute right-2 top-2 z-10 rounded-full bg-black/70 p-1.5 text-white hover:bg-black/90 disabled:opacity-50"
                aria-label={`Remove ${video.title} from continue watching`}
                title="Remove from Continue watching"
              >
                <Icon name="close" className="text-base" />
              </button>
              <Link href={watchHref(video)} className="block">
                <div className="relative aspect-video overflow-hidden rounded-xl bg-surface-container-high">
                  {video.thumbnailUrl ? (
                    <Image
                      src={video.thumbnailUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 280px, (max-width: 768px) 300px, 320px"
                    />
                  ) : null}
                  {video.durationSeconds ? (
                    <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">
                      {formatDuration(video.durationSeconds)}
                    </span>
                  ) : null}
                  {pct != null ? (
                    <div
                      className="absolute inset-x-0 bottom-0 h-1 bg-black/40"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${pct}% watched`}
                    >
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  ) : null}
                </div>
                <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-on-surface">{video.title}</h3>
                {video.user?.displayName ? (
                  <p className="mt-1 text-xs text-on-surface-variant">{video.user.displayName}</p>
                ) : null}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
