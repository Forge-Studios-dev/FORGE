'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState, Icon, ListSkeleton, PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';
import { getMyVideos } from '@/lib/creator-studio';

type Playlist = {
  id: string;
  title: string;
  visibility: string;
  videoCount?: number;
  createdAt?: string;
};

type PlaylistVideoItem = {
  id: string;
  videoId?: string;
  video?: { id: string; title: string; status?: string } | null;
};

export default function StudioPlaylistsPage() {
  const { user, isCreator, canEngage } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [error, setError] = useState('');
  const [manageId, setManageId] = useState<string | null>(null);
  const [attachVideoId, setAttachVideoId] = useState('');
  const [attachError, setAttachError] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['studio-playlists'],
    enabled: canEngage,
    queryFn: async () => {
      const { data } = await api.get<{ data: Playlist[] | { data: Playlist[] } }>('/playlists/me');
      const payload = data.data;
      return Array.isArray(payload) ? payload : payload?.data ?? [];
    },
  });

  const { data: managedPlaylist } = useQuery({
    queryKey: ['studio-playlist-detail', manageId],
    enabled: !!manageId,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Playlist & { items?: PlaylistVideoItem[] };
      }>(`/playlists/${manageId}`);
      return data.data;
    },
  });

  const { data: attachableVideos = [] } = useQuery({
    queryKey: ['studio-playlist-attachable-videos', user?.id],
    enabled: canEngage && !!manageId,
    queryFn: async () => {
      const videos = await getMyVideos(user?.id);
      return videos.filter((v) => v.status === 'ready');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/playlists', {
        title: title.trim(),
        visibility,
      });
    },
    onSuccess: () => {
      setTitle('');
      setError('');
      void qc.invalidateQueries({ queryKey: ['studio-playlists'] });
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not create playlist.')),
  });

  const attachMutation = useMutation({
    mutationFn: async () => {
      if (!manageId || !attachVideoId) return;
      await api.post(`/playlists/${manageId}/videos`, { videoId: attachVideoId });
    },
    onSuccess: () => {
      setAttachVideoId('');
      setAttachError('');
      void qc.invalidateQueries({ queryKey: ['studio-playlist-detail', manageId] });
      void qc.invalidateQueries({ queryKey: ['studio-playlists'] });
    },
    onError: (e) => setAttachError(getApiErrorMessage(e, 'Could not add video.')),
  });

  const removeMutation = useMutation({
    mutationFn: async (videoId: string) => {
      if (!manageId) return;
      await api.delete(`/playlists/${manageId}/videos/${videoId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['studio-playlist-detail', manageId] });
      void qc.invalidateQueries({ queryKey: ['studio-playlists'] });
    },
  });

  if (!canEngage) {
    return (
      <main className="space-y-4">
        <PageHeader title="Playlists" subtitle="Sign in to manage playlists." />
      </main>
    );
  }

  const managedItems = managedPlaylist?.items ?? [];
  const activePlaylist = data?.find((p) => p.id === manageId) ?? managedPlaylist ?? null;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Playlists"
        subtitle="Group lessons into curated learning paths learners can binge."
      />

      <section className="glass-panel space-y-4 rounded-2xl p-6">
        <div>
          <p className="font-label-caps text-xs text-outline">New playlist</p>
          <h2 className="mt-1 text-lg font-semibold">Create a collection</h2>
        </div>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Playlist title"
          className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <label className="block text-sm">
          <span className="text-on-surface-variant">Visibility</span>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
            className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </label>
        <button
          type="button"
          disabled={!title.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="primary-button inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          <Icon name="add" />
          {createMutation.isPending ? 'Creating…' : 'Create playlist'}
        </button>
        {!isCreator ? (
          <p className="text-xs text-outline">
            Anyone can create personal playlists. Creators can also attach them during upload.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your playlists</h2>
        {isLoading ? <ListSkeleton rows={4} /> : null}
        {isError ? <p className="text-sm text-error">Failed to load playlists.</p> : null}
        {!isLoading && !isError && !(data?.length ?? 0) ? (
          <EmptyState
            icon="playlist_play"
            title="No playlists yet"
            description="Create a playlist, then add ready lessons from your library."
            action={{ label: 'Upload a lesson', href: '/upload' }}
          />
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {(data ?? []).map((playlist) => (
            <article key={playlist.id} className="glass-panel rounded-2xl p-5">
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="font-semibold">{playlist.title}</h3>
                <StatusPill tone="neutral" label={playlist.visibility} />
              </div>
              <p className="text-sm text-on-surface-variant">
                {playlist.videoCount != null ? `${playlist.videoCount} videos` : 'Open to manage videos'}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setManageId(playlist.id);
                    setAttachVideoId('');
                    setAttachError('');
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Manage videos
                </button>
                <Link href={`/playlists/${playlist.id}`} className="text-sm text-on-surface-variant hover:underline">
                  Public view
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {manageId && activePlaylist ? (
        <section className="glass-panel space-y-4 rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-label-caps text-xs text-outline">Videos in playlist</p>
              <h2 className="mt-1 text-lg font-semibold">{activePlaylist.title}</h2>
            </div>
            <button
              type="button"
              onClick={() => setManageId(null)}
              className="text-sm text-on-surface-variant hover:underline"
            >
              Close
            </button>
          </div>

          {attachError ? <p className="text-sm text-error">{attachError}</p> : null}

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <select
              value={attachVideoId}
              onChange={(e) => setAttachVideoId(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm"
            >
              <option value="">Select a ready video</option>
              {attachableVideos.map((video) => (
                <option key={video.id} value={video.id}>
                  {video.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!attachVideoId || attachMutation.isPending}
              onClick={() => attachMutation.mutate()}
              className="primary-button inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              {attachMutation.isPending ? 'Adding…' : 'Add video'}
            </button>
          </div>

          {managedItems.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No videos in this playlist yet.</p>
          ) : (
            <ul className="space-y-2">
              {managedItems.map((item) => {
                const videoId = item.video?.id ?? item.videoId;
                const title = item.video?.title ?? 'Video';
                if (!videoId) return null;
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{title}</span>
                    <button
                      type="button"
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(videoId)}
                      className="text-sm text-error hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
