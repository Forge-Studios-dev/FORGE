'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { Stream, User } from '@/types';
import { resolveStreamPoster } from '@/lib/stream-poster';
import { useAuth } from '@/lib/auth';
import { EmptyState } from '@/components/EmptyState';
import { FeedGridSkeleton } from '@/components/LoadingSkeleton';

export default function LiveDirectoryPage() {
  const { isGuest, canGoLive, canApplyForCreator } = useAuth();
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  const { data: streams, isLoading, isError, refetch } = useQuery({
    queryKey: ['live-streams'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Stream[] }>('/streams/live');
      return data.data;
    },
    refetchInterval: 15_000,
  });

  async function startStream() {
    const t = title.trim();
    if (!t) return;
    setCreateErr('');
    setCreating(true);
    try {
      const { data } = await api.post<{ data: Stream }>('/streams/start', { title: t });
      setTitle('');
      await refetch();
      window.location.href = `/live/${data.data.id}`;
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateErr(typeof m === 'string' ? m : 'Could not start stream. Check creator approval and email verification.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <PageHeader title="Live now" subtitle="Watch skill-first sessions or start your own with OBS" />

      {canGoLive ? (
        <div className="glass-panel mb-10 space-y-3 rounded-xl p-5">
          <h2 className="text-sm font-semibold">Go live</h2>
          <p className="text-xs text-on-surface-variant">
            Creates a Mux live stream. After starting, open your stream page for the RTMP URL and stream key (use in OBS).
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title"
              className="flex-1 min-w-0 rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              disabled={creating || title.trim().length < 2}
              onClick={() => void startStream()}
              className="primary-button shrink-0 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {creating ? 'Starting…' : 'Create stream'}
            </button>
          </div>
          {createErr ? <p className="text-sm text-error">{createErr}</p> : null}
        </div>
      ) : !isGuest && canApplyForCreator ? (
        <p className="mb-8 text-sm text-on-surface-variant">
          <Link href="/upload/become-creator" className="text-primary hover:underline">
            Become a creator
          </Link>{' '}
          to go live. Browse sessions below.
        </p>
      ) : !isGuest ? (
        <p className="mb-8 text-sm text-on-surface-variant">
          Verified creators with approval can start streams from this page. Browse live sessions below.
        </p>
      ) : (
        <p className="mb-8 text-sm text-on-surface-variant">
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>{' '}
          to go live once you are an approved creator.
        </p>
      )}

      {isLoading ? (
        <FeedGridSkeleton count={4} />
      ) : isError ? (
        <EmptyState
          icon="error"
          title="Couldn't load live streams"
          description="Check your connection and try again."
          action={{ label: 'Retry', href: '/live' }}
          onAction={() => refetch()}
        />
      ) : !streams?.length ? (
        <EmptyState
          icon="sensors"
          title="No one is live right now"
          description={canGoLive ? 'Create a stream above, then broadcast with OBS.' : 'Check back later for live lessons.'}
        />
      ) : (
        <ul className="forge-stagger grid gap-4 sm:grid-cols-2">
          {streams.map((s) => {
            const poster = resolveStreamPoster(s);
            return (
            <li key={s.id}>
              <Link
                href={`/live/${s.id}`}
                className="forge-card-hover glass-panel block overflow-hidden rounded-xl transition hover:border-primary/30"
              >
                <div className="relative aspect-video bg-surface-container-lowest">
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-outline">
                      Live
                    </div>
                  )}
                  <span className="font-label-caps absolute left-3 top-3 text-live">● LIVE</span>
                </div>
                <div className="p-4">
                  <p className="line-clamp-2 font-medium">{s.title}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {(s.user as User)?.displayName ?? 'Creator'}
                  </p>
                </div>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
