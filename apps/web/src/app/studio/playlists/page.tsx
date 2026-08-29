'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button, EmptyState, Icon, ListSkeleton, PageHeader, StatusPill } from '@forge/design-system';
import { ConfirmDialog } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';
import { fetchStudioLibrary } from '@/lib/creator-studio';

type Playlist = {
  id: string;
  title: string;
  description?: string | null;
  visibility: string;
  videoCount?: number;
  createdAt?: string;
  systemType?: string | null;
};

type PlaylistVideoItem = {
  id: string;
  videoId?: string;
  video?: { id: string; title: string; status?: string } | null;
};

type PlaylistSort = 'recent' | 'az' | 'za';
type VisibilityFilter = '' | 'public' | 'unlisted' | 'private';

export default function StudioPlaylistsPage() {
  const { user, isCreator, canEngage } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [error, setError] = useState('');
  const [manageId, setManageId] = useState<string | null>(null);
  const [attachVideoId, setAttachVideoId] = useState('');
  const [attachError, setAttachError] = useState('');
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('');
  const [sort, setSort] = useState<PlaylistSort>('recent');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [itemSearch, setItemSearch] = useState('');
  const [shareHint, setShareHint] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['studio-playlists'],
    enabled: canEngage,
    queryFn: async () => {
      const { data } = await api.get<{ data: Playlist[] | { data: Playlist[] } }>('/playlists/me');
      const payload = data.data;
      return Array.isArray(payload) ? payload : payload?.data ?? [];
    },
  });

  const customPlaylists = useMemo(
    () => (data ?? []).filter((p) => !p.systemType),
    [data],
  );

  const filteredPlaylists = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = customPlaylists.filter((p) => {
      if (visibilityFilter && p.visibility !== visibilityFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
      );
    });
    if (sort === 'az') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'za') {
      list = [...list].sort((a, b) => b.title.localeCompare(a.title));
    }
    // recent = API order (createdAt DESC among customs)
    return list;
  }, [customPlaylists, search, visibilityFilter, sort]);

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
      const page = await fetchStudioLibrary({
        status: 'ready',
        sort: 'recent',
        limit: 100,
        page: 1,
      });
      return page.items;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/playlists', {
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
      });
    },
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setError('');
      void qc.invalidateQueries({ queryKey: ['studio-playlists'] });
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not create playlist.')),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!manageId) return;
      await api.patch(`/playlists/${manageId}`, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        visibility: editVisibility,
      });
    },
    onSuccess: () => {
      setError('');
      void qc.invalidateQueries({ queryKey: ['studio-playlists'] });
      void qc.invalidateQueries({ queryKey: ['studio-playlist-detail', manageId] });
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not update playlist.')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (playlistId: string) => {
      await api.delete(`/playlists/${playlistId}`);
    },
    onSuccess: () => {
      if (manageId === deleteId) setManageId(null);
      setDeleteId(null);
      void qc.invalidateQueries({ queryKey: ['studio-playlists'] });
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not delete playlist.')),
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

  const reorderMutation = useMutation({
    mutationFn: async (videoIds: string[]) => {
      if (!manageId) return;
      await api.put(`/playlists/${manageId}/reorder`, { videoIds });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['studio-playlist-detail', manageId] });
    },
    onError: (e) => setAttachError(getApiErrorMessage(e, 'Could not reorder playlist.')),
  });

  const moveItem = (index: number, direction: -1 | 1) => {
    const items = managedPlaylist?.items ?? [];
    const next = index + direction;
    if (next < 0 || next >= items.length) return;
    const ids = items.map((i) => i.video?.id ?? i.videoId).filter(Boolean) as string[];
    if (ids.length !== items.length) return;
    const tmp = ids[index]!;
    ids[index] = ids[next]!;
    ids[next] = tmp;
    reorderMutation.mutate(ids);
  };

  const copyPlaylistLink = async (playlistId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/playlists/${playlistId}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareHint(playlistId);
      window.setTimeout(() => setShareHint(null), 2000);
    } catch {
      setError('Could not copy playlist link.');
    }
  };

  const openManage = (playlist: Playlist) => {
    setManageId(playlist.id);
    setAttachVideoId('');
    setAttachError('');
    setItemSearch('');
    setEditTitle(playlist.title);
    setEditDescription(playlist.description ?? '');
    setEditVisibility(
      playlist.visibility === 'unlisted' || playlist.visibility === 'private'
        ? playlist.visibility
        : 'public',
    );
  };

  if (!canEngage) {
    return (
      <main className="space-y-4">
        <PageHeader title="Playlists" subtitle="Sign in to manage playlists." />
      </main>
    );
  }

  const managedItems = managedPlaylist?.items ?? [];
  const canReorder = !itemSearch.trim();
  const filteredItems = itemSearch.trim()
    ? managedItems.filter((item) =>
        (item.video?.title ?? '').toLowerCase().includes(itemSearch.trim().toLowerCase()),
      )
    : managedItems;
  const activePlaylist = customPlaylists.find((p) => p.id === manageId) ?? managedPlaylist ?? null;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Playlists"
        subtitle="Organize videos into playlists viewers can binge."
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
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          maxLength={500}
          className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <label className="block text-sm">
          <span className="text-on-surface-variant">Visibility</span>
          <select
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value as 'public' | 'unlisted' | 'private')
            }
            className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5"
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </label>
        <Button
          type="button"
          variant="primary"
          disabled={!title.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="gap-2 px-5"
        >
          <Icon name="add" />
          {createMutation.isPending ? 'Creating…' : 'Create playlist'}
        </Button>
        {!isCreator ? (
          <p className="text-xs text-outline">
            Anyone can create personal playlists. Creators can also attach them during upload.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Your playlists</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search playlists"
                aria-label="Search playlists"
                className="rounded-full border border-outline-variant bg-surface-container-low py-2 pl-10 pr-4 text-sm"
              />
            </div>
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as VisibilityFilter)}
              aria-label="Filter by visibility"
              className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            >
              <option value="">All visibility</option>
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as PlaylistSort)}
              aria-label="Sort playlists"
              className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            >
              <option value="recent">Recently created</option>
              <option value="az">A–Z</option>
              <option value="za">Z–A</option>
            </select>
          </div>
        </div>
        {isLoading ? <ListSkeleton rows={4} /> : null}
        {isError ? <p className="text-sm text-error">Failed to load playlists.</p> : null}
        {!isLoading && !isError && customPlaylists.length === 0 ? (
          <EmptyState
            icon="playlist_play"
            title="No playlists yet"
            description="Create a playlist, then add ready videos from your library."
            action={{ label: 'Upload a video', href: '/upload' }}
          />
        ) : null}
        {!isLoading && !isError && customPlaylists.length > 0 && filteredPlaylists.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No playlists match these filters.</p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {filteredPlaylists.map((playlist) => (
            <article key={playlist.id} className="glass-panel rounded-2xl p-5">
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="font-semibold">{playlist.title}</h3>
                <StatusPill tone="neutral" label={playlist.visibility} />
              </div>
              {playlist.description ? (
                <p className="mb-2 line-clamp-2 text-sm text-on-surface-variant">
                  {playlist.description}
                </p>
              ) : null}
              <p className="text-sm text-on-surface-variant">
                {playlist.videoCount != null
                  ? `${playlist.videoCount} videos`
                  : 'Open to manage videos'}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openManage(playlist)}
                  className="text-sm text-primary hover:underline"
                >
                  Manage
                </button>
                <Link
                  href={`/playlists/${playlist.id}`}
                  className="text-sm text-on-surface-variant hover:underline"
                >
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => void copyPlaylistLink(playlist.id)}
                  className="text-sm text-on-surface-variant hover:underline"
                >
                  {shareHint === playlist.id ? 'Copied' : 'Copy link'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(playlist.id)}
                  className="text-sm text-error hover:underline"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {manageId && activePlaylist ? (
        <section className="glass-panel space-y-4 rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-label-caps text-xs text-outline">Edit playlist</p>
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

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm md:col-span-2">
              <span className="text-on-surface-variant">Title</span>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm"
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-on-surface-variant">Description</span>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                maxLength={500}
                className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-on-surface-variant">Visibility</span>
              <select
                value={editVisibility}
                onChange={(e) =>
                  setEditVisibility(e.target.value as 'public' | 'unlisted' | 'private')
                }
                className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 text-sm"
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                disabled={!editTitle.trim() || updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
                className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save details'}
              </button>
            </div>
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
            <Button
              type="button"
              variant="primary"
              disabled={!attachVideoId || attachMutation.isPending}
              onClick={() => attachMutation.mutate()}
              className="gap-2 px-5"
            >
              {attachMutation.isPending ? 'Adding…' : 'Add video'}
            </Button>
          </div>

          {managedItems.length >= 4 ? (
            <input
              type="search"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Search this playlist"
              aria-label="Search this playlist"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-2.5 text-sm"
            />
          ) : null}

          {filteredItems.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              {itemSearch.trim() ? 'No videos match this search.' : 'No videos in this playlist yet.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredItems.map((item) => {
                const videoId = item.video?.id ?? item.videoId;
                const itemTitle = item.video?.title ?? 'Video';
                if (!videoId) return null;
                const index = managedItems.findIndex((i) => i.id === item.id);
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-5 shrink-0 text-center text-xs text-outline">
                        {index >= 0 ? index + 1 : '·'}
                      </span>
                      <span className="truncate font-medium">{itemTitle}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {canReorder && index >= 0 ? (
                        <div className="flex flex-col">
                          <button
                            type="button"
                            disabled={index === 0 || reorderMutation.isPending}
                            onClick={() => moveItem(index, -1)}
                            className="rounded p-0.5 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30"
                            aria-label="Move up"
                          >
                            <Icon name="keyboard_arrow_up" className="text-lg" />
                          </button>
                          <button
                            type="button"
                            disabled={
                              index === managedItems.length - 1 || reorderMutation.isPending
                            }
                            onClick={() => moveItem(index, 1)}
                            className="rounded p-0.5 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30"
                            aria-label="Move down"
                          >
                            <Icon name="keyboard_arrow_down" className="text-lg" />
                          </button>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        disabled={removeMutation.isPending}
                        onClick={() => removeMutation.mutate(videoId)}
                        className="text-sm text-error hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete playlist?"
        description="This permanently deletes the playlist. Videos stay on your channel."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId);
        }}
        onCancel={() => setDeleteId(null)}
        loading={deleteMutation.isPending}
      />
    </main>
  );
}
