'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function NewPlaylistClient() {
  const router = useRouter();
  const params = useSearchParams();
  const videoId = useMemo(() => params.get('videoId'), [params]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const { user, isGuest } = useAuth();

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Title is required');
      const { data } = await api.post('/playlists', { title: title.trim() });
      return data.data as { id: string };
    },
    onSuccess: async (playlist) => {
      if (videoId) {
        try {
          await api.post(`/playlists/${playlist.id}/videos`, { videoId });
        } catch {
          // user can add videos later
        }
      }
      router.push(`/playlists/${playlist.id}`);
    },
    onError: (e: unknown) => {
      const msg = (e as { message?: string })?.message;
      setError(msg || 'Failed to create playlist');
    },
  });

  if (isGuest) {
    return (
      <main className="mx-auto max-w-xl px-5 py-10 md:px-12">
        <div className="glass-panel rounded-2xl p-8 text-center">
          <h1 className="font-display-forge text-xl font-semibold">Create playlist</h1>
          <p className="mt-2 text-sm text-on-surface-variant">Sign in to save lessons to a playlist.</p>
          <Link href="/login" className="primary-button mt-6 inline-flex rounded-full px-6 py-2 text-sm font-semibold text-on-primary">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-8 md:px-12">
      <PageHeader title="Create playlist" subtitle="Save videos you want to revisit" />
      <div className="glass-panel mt-6 space-y-4 rounded-2xl p-6">
        {error && (
          <p className="rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">{error}</p>
        )}
        <label className="block">
          <span className="font-label-caps text-outline">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-2.5 text-on-surface outline-none focus:border-primary"
            placeholder="My learning playlist"
          />
        </label>
        <button
          type="button"
          onClick={() => create.mutate()}
          disabled={create.isPending || title.trim().length < 2}
          className="primary-button w-full rounded-full py-3 text-sm font-semibold text-on-primary disabled:opacity-40"
        >
          {create.isPending ? 'Creating…' : 'Create playlist'}
        </button>
      </div>
    </main>
  );
}
