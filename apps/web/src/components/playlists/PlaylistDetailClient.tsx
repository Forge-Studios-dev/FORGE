'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState, Icon, Input, ListSkeleton, PageHeader, buttonClassName } from '@forge/design-system';
import { ConfirmDialog } from '@forge/design-system/client';
import { isAxiosError } from 'axios';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Playlist } from '@/types';
import { formatCount } from '@/lib/utils';

export function PlaylistDetailClient({ playlistId }: { playlistId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [itemQuery, setItemQuery] = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const query = useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Playlist }>(`/playlists/${playlistId}`);
      return data.data;
    },
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const title = item.video?.title?.toLowerCase() ?? '';
      const channel = item.video?.user?.displayName?.toLowerCase() ?? '';
      return title.includes(q) || channel.includes(q);
    });
  }, [items, itemQuery]);

  const removeMutation = useMutation({
    mutationFn: (videoId: string) => api.delete(`/playlists/${playlistId}/videos/${videoId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['playlist', playlistId] }),
  });

  const clearMutation = useMutation({
    mutationFn: async (systemType: 'watch_later' | 'liked') => {
      if (systemType === 'liked') {
        await api.delete('/playlists/me/liked/videos');
        return;
      }
      await api.delete('/playlists/me/watch-later/videos');
    },
    onSuccess: () => {
      setClearOpen(false);
      void qc.invalidateQueries({ queryKey: ['playlist', playlistId] });
      void qc.invalidateQueries({ queryKey: ['playlists', 'me'] });
      void qc.invalidateQueries({ queryKey: ['playlist-liked'] });
      void qc.invalidateQueries({ queryKey: ['playlist-watch-later'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (videoIds: string[]) =>
      api.put(`/playlists/${playlistId}/reorder`, { videoIds }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['playlist', playlistId] }),
  });

  const updateMutation = useMutation({
    mutationFn: (body: {
      visibility?: 'public' | 'unlisted' | 'private';
      title?: string;
      description?: string | null;
    }) => api.patch(`/playlists/${playlistId}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['playlist', playlistId] });
      void qc.invalidateQueries({ queryKey: ['playlists', 'me'] });
      setEditingTitle(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/playlists/${playlistId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['playlists', 'me'] });
      router.push('/library');
    },
  });

  if (query.isLoading) {
    return (
      <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
        <ListSkeleton rows={6} />
      </main>
    );
  }

  if (query.isError || !query.data) {
    const unavailable = isAxiosError(query.error) && query.error.response?.status === 403;
    return (
      <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
        <EmptyState
          icon={unavailable ? 'block' : 'error'}
          title={unavailable ? 'This playlist is not available' : 'Playlist not found'}
          description={
            unavailable
              ? 'Access to this playlist is restricted on your account.'
              : 'It may be private or deleted.'
          }
          action={{ label: 'Library', href: '/library' }}
        />
      </main>
    );
  }

  const playlist = query.data;
  const isOwner = !!user && user.id === playlist.userId;
  const isSystem = !!playlist.systemType;
  const canReorder = isOwner && !isGuest && !isSystem && !itemQuery.trim();
  const playAllHref = items[0]
    ? `/watch/${items[0].videoId}?list=${encodeURIComponent(playlistId)}`
    : null;

  const moveItem = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= items.length) return;
    const ids = items.map((i) => i.videoId);
    const tmp = ids[index];
    ids[index] = ids[next];
    ids[next] = tmp;
    reorderMutation.mutate(ids);
  };

  const startRename = () => {
    setTitleDraft(playlist.title);
    setDescriptionDraft(playlist.description ?? '');
    setEditingTitle(true);
  };

  const copyPlaylistLink = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/playlists/${playlistId}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareHint('Link copied');
      window.setTimeout(() => setShareHint(null), 2000);
    } catch {
      setShareHint('Could not copy link');
      window.setTimeout(() => setShareHint(null), 2000);
    }
  };

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          {editingTitle && isOwner && !isSystem ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const nextTitle = titleDraft.trim();
                if (!nextTitle) {
                  setEditingTitle(false);
                  return;
                }
                const nextDesc = descriptionDraft.trim();
                const titleChanged = nextTitle !== playlist.title;
                const descChanged = nextDesc !== (playlist.description ?? '');
                if (!titleChanged && !descChanged) {
                  setEditingTitle(false);
                  return;
                }
                updateMutation.mutate({
                  title: titleChanged ? nextTitle : undefined,
                  description: descChanged ? nextDesc || null : undefined,
                });
              }}
            >
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                maxLength={200}
                className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 font-display-forge text-2xl font-bold"
                aria-label="Playlist title"
                autoFocus
              />
              <textarea
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Description (optional)"
                className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface"
                aria-label="Playlist description"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={updateMutation.isPending || !titleDraft.trim()}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTitle(false)}
                  className="rounded-full px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <PageHeader
              title={playlist.title}
              subtitle={`${items.length} video${items.length === 1 ? '' : 's'}${
                playlist.description ? ` · ${playlist.description}` : ''
              }`}
            />
          )}
          {isOwner && !isGuest && !isSystem && !editingTitle ? (
            <button
              type="button"
              onClick={startRename}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Edit details
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {playAllHref ? (
            <Link
              href={playAllHref}
              className={`${buttonClassName('primary')} gap-2`}
            >
              <Icon name="play_arrow" />
              Play all
            </Link>
          ) : null}
          {items.length > 1 ? (
            <button
              type="button"
              onClick={() => {
                const start = items[Math.floor(Math.random() * items.length)]!;
                router.push(
                  `/watch/${start.videoId}?list=${encodeURIComponent(playlistId)}&shuffle=1`,
                );
              }}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-high"
            >
              <Icon name="shuffle" className="text-base" />
              Shuffle
            </button>
          ) : null}
          {playlist.visibility !== 'private' || isOwner ? (
            <button
              type="button"
              onClick={() => void copyPlaylistLink()}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:bg-surface-container-high"
            >
              <Icon name="share" className="text-base" />
              {shareHint ?? 'Share'}
            </button>
          ) : null}
          {isOwner && !isGuest && !isSystem ? (
            <label className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 px-4 py-2 text-sm text-on-surface-variant">
              <Icon
                name={
                  playlist.visibility === 'private'
                    ? 'lock'
                    : playlist.visibility === 'unlisted'
                      ? 'link'
                      : 'public'
                }
                className="text-base"
              />
              <select
                value={
                  playlist.visibility === 'private'
                    ? 'private'
                    : playlist.visibility === 'unlisted'
                      ? 'unlisted'
                      : 'public'
                }
                disabled={updateMutation.isPending}
                onChange={(e) =>
                  updateMutation.mutate({
                    visibility: e.target.value as 'public' | 'unlisted' | 'private',
                  })
                }
                className="bg-transparent text-sm font-medium text-on-surface outline-none"
                aria-label="Playlist visibility"
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </label>
          ) : (
            <span className="inline-flex items-center gap-1 self-center text-xs text-outline">
              <Icon
                name={
                  playlist.visibility === 'private'
                    ? 'lock'
                    : playlist.visibility === 'unlisted'
                      ? 'link'
                      : 'public'
                }
                className="text-sm"
              />
              {playlist.visibility === 'private'
                ? 'Private'
                : playlist.visibility === 'unlisted'
                  ? 'Unlisted'
                  : 'Public'}
            </span>
          )}
          {isOwner && !isGuest && isSystem && items.length > 0 ? (
            <button
              type="button"
              disabled={clearMutation.isPending}
              onClick={() => setClearOpen(true)}
              className="rounded-full border border-error/40 px-4 py-2 text-sm font-semibold text-error hover:bg-error/10 disabled:opacity-50"
            >
              {clearMutation.isPending ? 'Clearing…' : 'Clear all'}
            </button>
          ) : null}
          {isOwner && !isGuest && !isSystem ? (
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteOpen(true)}
              className="rounded-full border border-error/40 px-4 py-2 text-sm font-semibold text-error hover:bg-error/10 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </button>
          ) : null}
          {!isSystem ? (
            <Link
              href="/playlists/new"
              className="rounded-full border border-outline-variant/40 px-5 py-2 text-sm font-semibold hover:bg-surface-container-high"
            >
              New playlist
            </Link>
          ) : null}
        </div>
      </div>

      {items.length > 3 ? (
        <div className="relative mb-4 max-w-md">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <Input
            value={itemQuery}
            onChange={(e) => setItemQuery(e.target.value)}
            placeholder="Search this playlist"
            className="pl-10"
            aria-label="Search playlist videos"
          />
        </div>
      ) : null}

      <ul className="space-y-3">
        {filteredItems.map((item) => {
          const video = item.video;
          const index = items.findIndex((i) => i.id === item.id);
          return (
            <li key={item.id} className="glass-panel flex items-center gap-4 rounded-xl p-3">
              <span className="w-6 shrink-0 text-center text-sm text-outline">{index + 1}</span>
              <Link
                href={`/watch/${item.videoId}?list=${encodeURIComponent(playlistId)}`}
                className="flex min-w-0 flex-1 items-center gap-4"
              >
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-surface-container-high">
                  {video?.thumbnailUrl ? (
                    <Image
                      src={video.thumbnailUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="112px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Icon name="play_circle" className="text-2xl text-primary" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{video?.title ?? 'Video'}</p>
                  <p className="truncate text-sm text-on-surface-variant">
                    {video?.user?.displayName ?? 'Channel'}
                    {video?.viewCount != null ? ` · ${formatCount(video.viewCount)} views` : ''}
                  </p>
                </div>
              </Link>
              {canReorder ? (
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    disabled={index === 0 || reorderMutation.isPending}
                    onClick={() => moveItem(index, -1)}
                    className="rounded p-1 text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <Icon name="keyboard_arrow_up" className="text-lg" />
                  </button>
                  <button
                    type="button"
                    disabled={index === items.length - 1 || reorderMutation.isPending}
                    onClick={() => moveItem(index, 1)}
                    className="rounded p-1 text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <Icon name="keyboard_arrow_down" className="text-lg" />
                  </button>
                </div>
              ) : null}
              {isOwner && !isGuest ? (
                <button
                  type="button"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(item.videoId)}
                  className="shrink-0 rounded-full p-2 text-on-surface-variant hover:bg-surface-container-highest hover:text-error"
                  aria-label={
                    playlist.systemType === 'liked'
                      ? 'Remove from Liked videos'
                      : playlist.systemType === 'watch_later'
                        ? 'Remove from Watch later'
                        : 'Remove from playlist'
                  }
                >
                  <Icon name="close" />
                </button>
              ) : null}
            </li>
          );
        })}
        {!items.length ? (
          <li className="glass-panel rounded-xl p-10 text-center text-on-surface-variant">
            This playlist is empty.
          </li>
        ) : !filteredItems.length ? (
          <li className="glass-panel rounded-xl p-10 text-center text-on-surface-variant">
            No videos match “{itemQuery.trim()}”.
          </li>
        ) : null}
      </ul>

      <ConfirmDialog
        open={clearOpen}
        title={
          playlist.systemType === 'liked'
            ? 'Clear Liked videos?'
            : 'Clear Watch later?'
        }
        description={`Remove all videos from ${
          playlist.systemType === 'liked' ? 'Liked videos' : 'Watch later'
        }?`}
        confirmLabel="Clear all"
        onConfirm={() =>
          clearMutation.mutate(playlist.systemType === 'liked' ? 'liked' : 'watch_later')
        }
        onCancel={() => setClearOpen(false)}
        loading={clearMutation.isPending}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete playlist?"
        description="Videos themselves are not deleted — only this playlist."
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleteOpen(false)}
        loading={deleteMutation.isPending}
      />
    </main>
  );
}
