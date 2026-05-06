'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/permissions';

export function NewPlaylistClient() {
  const router = useRouter();
  const params = useSearchParams();
  const videoId = useMemo(() => params.get('videoId'), [params]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const user = getStoredUser();

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
          // ignore; user can add later
        }
      }
      router.push(`/playlists/${playlist.id}`);
    },
    onError: (e: unknown) => {
      const msg = (e as { message?: string })?.message;
      setError(msg || 'Failed to create playlist');
    },
  });

  if (!user) {
    return (
      <main className="min-h-screen">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="glass rounded-2xl p-6 border border-white/10">
            <h1 className="text-2xl font-bold">Create playlist</h1>
            <p className="text-gray-400 mt-2">Please sign in to create playlists.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-bold">Create playlist</h1>
        <p className="text-gray-400 mt-2">Save videos you want to revisit.</p>

        <div className="mt-6 glass rounded-2xl p-6 border border-white/10 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-forge-500 transition"
              placeholder="My learning playlist"
            />
          </div>

          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="bg-forge-600 hover:bg-forge-500 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg transition"
          >
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </main>
  );
}

