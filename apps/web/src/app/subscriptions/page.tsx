'use client';

import Link from 'next/link';
import { Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Avatar, EmptyState, FeedGridSkeleton, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { FeedGrid } from '@/components/FeedCard/FeedGrid';
import { User } from '@/types';

function SubscriptionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channelFilter = searchParams.get('channel') || undefined;
  const { isGuest, canViewPersonalizedFeed, isLoading: authLoading, user } = useAuth();

  const channelsQuery = useQuery({
    queryKey: ['subscriptions-channels', user?.id],
    enabled: !authLoading && !isGuest && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: User[] } }>(
        `/channels/${user!.id}/subscriptions?limit=40`,
      );
      return data.data?.data ?? [];
    },
  });

  const channels = useMemo(() => channelsQuery.data ?? [], [channelsQuery.data]);
  const filteredChannel = useMemo(
    () => (channelFilter ? channels.find((c) => c.id === channelFilter) : null),
    [channels, channelFilter],
  );

  const setChannelFilter = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('channel', id);
    else params.delete('channel');
    const qs = params.toString();
    router.push(qs ? `/subscriptions?${qs}` : '/subscriptions');
  };

  if (isGuest) {
    return (
      <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
        <PageHeader title="Subscriptions" subtitle="Latest from channels you subscribe to" />
        <EmptyState
          icon="login"
          title="Sign in to see subscriptions"
          description="Subscribe to channels to build your personal feed."
          action={{ label: 'Sign in', href: '/login?next=/subscriptions' }}
        />
      </main>
    );
  }

  if (!authLoading && !canViewPersonalizedFeed) {
    return (
      <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
        <PageHeader title="Subscriptions" subtitle="Latest from channels you subscribe to" />
        <EmptyState
          icon="mark_email_unread"
          title="Verify your email"
          description="Confirm your email to see your subscriptions feed."
          action={{ label: 'Account settings', href: '/settings' }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <PageHeader
        title="Subscriptions"
        subtitle={
          filteredChannel
            ? `Latest from ${filteredChannel.displayName}`
            : 'Latest from channels you subscribe to'
        }
      />

      {channels.length > 0 || channelsQuery.isLoading ? (
        <section className="mb-8" aria-label="Subscribed channels">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-label-caps text-outline">Channels</h2>
            <div className="flex items-center gap-3">
              {channelFilter ? (
                <button
                  type="button"
                  onClick={() => setChannelFilter(null)}
                  className="text-sm text-primary hover:underline"
                >
                  All channels
                </button>
              ) : null}
              {user?.username ? (
                <Link href={`/${user.username}/subscriptions`} className="text-sm text-primary hover:underline">
                  Manage
                </Link>
              ) : null}
            </div>
          </div>
          {channelsQuery.isLoading ? (
            <div className="flex gap-4 overflow-hidden pb-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-surface-container-high"
                />
              ))}
            </div>
          ) : (
            <div className="hide-scrollbar flex gap-4 overflow-x-auto pb-2">
              {channels.map((channel) => {
                const active = channelFilter === channel.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setChannelFilter(active ? null : channel.id)}
                    aria-pressed={active}
                    className={`flex w-20 shrink-0 flex-col items-center gap-2 text-center ${
                      active ? 'opacity-100' : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    <span
                      className={`rounded-full p-0.5 ${
                        active ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                      }`}
                    >
                      <Avatar src={channel.avatarUrl} name={channel.displayName} size="lg" />
                    </span>
                    <span className="line-clamp-2 text-xs text-on-surface">{channel.displayName}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {authLoading || !canViewPersonalizedFeed ? (
        <FeedGridSkeleton count={8} />
      ) : (
        <FeedGrid
          feedPath="/videos/feed/following"
          channelId={channelFilter}
          initialData={{ data: [], meta: { cursor: null, hasMore: true } }}
        />
      )}
    </main>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<FeedGridSkeleton count={8} />}>
      <SubscriptionsContent />
    </Suspense>
  );
}
