'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import { User } from '@/types';

export function UserListPage({
  userId,
  type,
  username,
}: {
  userId: string;
  type: 'followers' | 'following';
  username: string;
}) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: [type, userId],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) params.set('cursor', pageParam as string);
      const listPath = type === 'followers' ? 'subscribers' : 'subscriptions';
      const { data } = await api.get<{ data: { data: User[]; meta: { cursor: string | null; hasMore: boolean } } }>(
        `/channels/${userId}/${listPath}?${params}`,
      );
      return data.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.cursor ?? undefined : undefined),
  });

  const users = data?.pages.flatMap((p) => p.data) ?? [];

  const title = type === 'followers' ? 'Subscribers' : 'Subscriptions';
  const emptyLabel = type === 'followers' ? 'No subscribers yet.' : 'No subscriptions yet.';

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 md:px-12">
      <Link href={`/${username}`} className="text-sm text-primary hover:underline">
        ← @{username}
      </Link>
      <h1 className="font-display-forge mt-4 text-2xl font-semibold">{title}</h1>

      {isLoading ? (
        <p className="mt-6 text-on-surface-variant">Loading…</p>
      ) : users.length === 0 ? (
        <p className="mt-6 text-on-surface-variant">{emptyLabel}</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {users.map((u) => (
            <li key={u.id}>
              <Link href={`/${u.username}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-container-high">
                {u.avatarUrl ? (
                  <Image src={u.avatarUrl} alt="" width={48} height={48} className="rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                    {u.displayName[0]}
                  </div>
                )}
                <div>
                  <p className="font-medium text-on-surface">{u.displayName}</p>
                  <p className="text-sm text-on-surface-variant">@{u.username}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-6 text-sm font-semibold text-primary hover:underline disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </main>
  );
}
