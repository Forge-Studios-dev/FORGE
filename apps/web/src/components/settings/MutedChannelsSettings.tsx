'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type MutedChannel = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export function MutedChannelsSettings() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['muted-channels'],
    queryFn: async () => {
      const { data } = await api.get<{ data: MutedChannel[] }>('/me/muted-channels');
      return data.data ?? [];
    },
  });

  const unmute = useMutation({
    mutationFn: async (channelId: string) => {
      await api.delete(`/channels/${channelId}/dont-recommend`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['muted-channels'] });
    },
  });

  return (
    <section id="recommendations" className="glass-panel mt-8 rounded-2xl p-6">
      <h2 className="font-display-forge text-lg font-semibold">Recommended content</h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        Channels you hid with “Don’t recommend channel” stay out of your home feed and related
        videos. Unmute anytime.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-on-surface-variant">Loading…</p>
      ) : null}
      {isError ? (
        <p className="mt-4 text-sm text-error" role="alert">
          Could not load muted channels.
        </p>
      ) : null}

      {!isLoading && !isError && !(data?.length ?? 0) ? (
        <p className="mt-4 text-sm text-on-surface-variant">No muted channels.</p>
      ) : null}

      {(data?.length ?? 0) > 0 ? (
        <ul className="mt-4 space-y-3">
          {data!.map((ch) => (
            <li
              key={ch.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2"
            >
              <Link href={`/${ch.username}`} className="flex min-w-0 items-center gap-3 hover:opacity-90">
                {ch.avatarUrl ? (
                  <Image
                    src={ch.avatarUrl}
                    alt=""
                    width={36}
                    height={36}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary">
                    {ch.displayName[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{ch.displayName}</p>
                  <p className="truncate text-xs text-on-surface-variant">@{ch.username}</p>
                </div>
              </Link>
              <button
                type="button"
                disabled={unmute.isPending}
                onClick={() => unmute.mutate(ch.id)}
                className="shrink-0 rounded-full border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface hover:border-primary disabled:opacity-60"
              >
                Unmute
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
