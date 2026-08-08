'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type BlockedUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  blockedAt?: string;
};

export function BlockedUsersSettings() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['blocked-users'],
    queryFn: async () => {
      const { data } = await api.get<{ data: BlockedUser[] }>('/me/blocked-users');
      return data.data ?? [];
    },
  });

  const unblock = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/users/${userId}/block`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['blocked-users'] });
    },
  });

  return (
    <section id="blocked" className="glass-panel mt-8 rounded-2xl p-6">
      <h2 className="font-display-forge text-lg font-semibold">Blocked users</h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        Blocked accounts can’t message you. Their comments are hidden, and their channel stays out
        of your recommendations. Unblock anytime.
      </p>

      {isLoading ? <p className="mt-4 text-sm text-on-surface-variant">Loading…</p> : null}
      {isError ? (
        <p className="mt-4 text-sm text-error" role="alert">
          Could not load blocked users.
        </p>
      ) : null}

      {!isLoading && !isError && !(data?.length ?? 0) ? (
        <p className="mt-4 text-sm text-on-surface-variant">No blocked users.</p>
      ) : null}

      {(data?.length ?? 0) > 0 ? (
        <ul className="mt-4 space-y-3">
          {data!.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2"
            >
              <Link href={`/${u.username}`} className="flex min-w-0 items-center gap-3 hover:opacity-90">
                {u.avatarUrl ? (
                  <Image
                    src={u.avatarUrl}
                    alt=""
                    width={36}
                    height={36}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary">
                    {u.displayName[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.displayName}</p>
                  <p className="truncate text-xs text-on-surface-variant">@{u.username}</p>
                </div>
              </Link>
              <button
                type="button"
                disabled={unblock.isPending}
                onClick={() => unblock.mutate(u.id)}
                className="shrink-0 rounded-full border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface hover:border-primary disabled:opacity-60"
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
