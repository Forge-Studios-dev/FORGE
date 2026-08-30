'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo } from 'react';
import { EmptyState, ListSkeleton, PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchStudioModerationInbox } from '@/lib/creator-studio';

type ModeratedCommunity = {
  communityId: string;
  role: string;
  community?: {
    id: string;
    name: string;
    slug: string;
    creatorId: string;
    creator?: { username?: string; displayName?: string };
  } | null;
};

type OwnedCommunity = {
  id: string;
  name: string;
  slug: string;
};

const INBOX_PAGE_SIZE = 30;

export default function StudioModerationHubPage() {
  const { user, isGuest, isCreator } = useAuth();

  const {
    data: moderated = [],
    isLoading: moderatedLoading,
    isError: moderatedError,
    refetch: refetchModerated,
  } = useQuery({
    queryKey: ['moderated-communities', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: res } = await api.get<{ data: { data: ModeratedCommunity[] } }>(
        '/creators/me/moderated-communities',
      );
      return res.data.data ?? [];
    },
  });

  const {
    data: owned = [],
    isLoading: ownedLoading,
    isError: ownedError,
    refetch: refetchOwned,
  } = useQuery({
    queryKey: ['studio-owned-communities-mod', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: OwnedCommunity[] }>(
        `/creators/${user!.id}/communities`,
      );
      return data.data ?? [];
    },
  });

  const {
    data: inboxPages,
    isLoading: inboxLoading,
    isError: inboxError,
    refetch: refetchInbox,
    isFetching: inboxFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['unified-mod-inbox', user?.id],
    enabled: !!user?.id,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchStudioModerationInbox({
        limit: INBOX_PAGE_SIZE,
        cursor: pageParam,
      }),
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
  });

  const communities = useMemo(() => {
    const byId = new Map<string, ModeratedCommunity>();
    for (const row of moderated) {
      byId.set(row.communityId, row);
    }
    for (const community of owned) {
      if (byId.has(community.id)) continue;
      byId.set(community.id, {
        communityId: community.id,
        role: 'owner',
        community: {
          id: community.id,
          name: community.name,
          slug: community.slug,
          creatorId: user!.id,
        },
      });
    }
    return [...byId.values()];
  }, [moderated, owned, user]);

  const isLoading = moderatedLoading || ownedLoading;
  const communitiesError = moderatedError || ownedError;
  const inboxItems = inboxPages?.pages.flatMap((p) => p.items) ?? [];
  const openReportCount = inboxPages?.pages[0]?.total ?? inboxItems.length;

  if (isGuest) {
    return (
      <main className="space-y-6">
        <p className="text-sm text-on-surface-variant">Sign in to access moderation tools.</p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Moderation center"
        subtitle="Review open reports across every community you own or help moderate."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Open reports</p>
          <p className="mt-2 text-3xl font-semibold">
            {inboxLoading ? '—' : openReportCount}
          </p>
        </article>
        <article className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Communities you moderate</p>
          <p className="mt-2 text-3xl font-semibold">
            {isLoading ? '—' : communities.length}
          </p>
        </article>
        <article className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Quick actions</p>
          <div className="mt-3 flex flex-col gap-2">
            <Link href="/messages" className="inline-flex text-sm text-primary hover:underline">
              Open messages
            </Link>
            <Link href="/studio" className="inline-flex text-sm text-on-surface-variant hover:underline">
              Studio dashboard
            </Link>
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,1fr)]">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Unified inbox</h2>
          {inboxLoading ? <ListSkeleton rows={4} /> : null}
          {inboxError ? (
            <div className="space-y-2">
              <p className="text-sm text-error">Failed to load moderation inbox.</p>
              <button
                type="button"
                className="text-sm font-semibold text-primary hover:underline"
                disabled={inboxFetching}
                onClick={() => void refetchInbox()}
              >
                {inboxFetching ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          ) : null}
          {!inboxLoading && !inboxError && openReportCount === 0 ? (
            <EmptyState
              icon="shield"
              title="Queue is clear"
              description="No open reports right now. New community reports will land here first."
            />
          ) : null}
          {!inboxLoading && !inboxError && openReportCount > 0 ? (
            <>
              {openReportCount > inboxItems.length ? (
                <p className="text-sm text-on-surface-variant">
                  Showing {inboxItems.length} of {openReportCount} reports
                </p>
              ) : null}
              <ul className="space-y-2">
                {inboxItems.map((r) => (
                  <li
                    key={r.id}
                    className="glass-panel flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <StatusPill tone="warning" label={r.status} />
                        <span className="text-xs text-outline">{r.targetType ?? 'content'}</span>
                      </div>
                      <p className="font-medium">{r.communityName ?? r.communityId}</p>
                      <p className="truncate text-xs text-on-surface-variant">{r.reason ?? 'Reported'}</p>
                    </div>
                    <Link
                      href={`/studio/moderation/${r.communityId}`}
                      className="shrink-0 text-xs text-primary hover:underline"
                    >
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
              {hasNextPage ? (
                <button
                  type="button"
                  className="text-sm font-semibold text-primary hover:underline disabled:opacity-60"
                  disabled={isFetchingNextPage}
                  onClick={() => void fetchNextPage()}
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Your communities</h2>
          {isLoading ? <ListSkeleton rows={3} /> : null}
          {communitiesError ? (
            <div className="space-y-2">
              <p className="text-sm text-error">Failed to load communities.</p>
              <button
                type="button"
                className="text-sm font-semibold text-primary hover:underline"
                onClick={() => {
                  void refetchModerated();
                  void refetchOwned();
                }}
              >
                Retry
              </button>
            </div>
          ) : null}
          {!isLoading && !communitiesError && !communities.length ? (
            <p className="text-sm text-on-surface-variant">
              You do not have moderator access on any communities yet.
            </p>
          ) : null}
          <ul className="space-y-2">
            {communities.map((row) => (
              <li key={`${row.communityId}-${row.role}`}>
                <Link
                  href={`/studio/moderation/${row.communityId}`}
                  className="glass-panel block rounded-2xl p-4 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.community?.name ?? row.communityId}</p>
                      <p className="text-xs text-on-surface-variant">
                        /{row.community?.slug ?? 'community'}
                      </p>
                    </div>
                    <StatusPill tone="primary" label={row.role} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
