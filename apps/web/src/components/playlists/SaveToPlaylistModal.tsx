'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { Icon } from '@forge/design-system';
import { Dialog } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-message';
import { Playlist } from '@/types';

type Props = {
  videoId: string;
  open: boolean;
  onClose: () => void;
};

export function SaveToPlaylistModal({ videoId, open, onClose }: Props) {
  const qc = useQueryClient();
  const titleId = useId();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [showCreateDetails, setShowCreateDetails] = useState(false);

  const playlistsQuery = useQuery({
    queryKey: ['playlists', 'me'],
    enabled: open,
    queryFn: async () => {
      const { data } = await api.get<{ data: Playlist[] }>('/playlists/me');
      return (data.data ?? []).filter((p) => p.systemType !== 'liked');
    },
  });

  const containingQuery = useQuery({
    queryKey: ['playlists', 'containing', videoId],
    enabled: open,
    queryFn: async () => {
      const { data } = await api.get<{ data: { playlistIds: string[] } }>(
        `/playlists/me/containing/${videoId}`,
      );
      return new Set(data.data.playlistIds ?? []);
    },
  });

  useEffect(() => {
    if (containingQuery.data) setSelected(new Set(containingQuery.data));
  }, [containingQuery.data]);

  const toggle = useMutation({
    mutationFn: async ({ playlistId, next }: { playlistId: string; next: boolean }) => {
      if (next) {
        await api.post(`/playlists/${playlistId}/videos`, { videoId });
      } else {
        await api.delete(`/playlists/${playlistId}/videos/${videoId}`);
      }
    },
    onMutate: ({ playlistId, next }) => {
      setError('');
      setSelected((prev) => {
        const copy = new Set(prev);
        if (next) copy.add(playlistId);
        else copy.delete(playlistId);
        return copy;
      });
    },
    onError: (err, { playlistId, next }) => {
      setSelected((prev) => {
        const copy = new Set(prev);
        if (next) copy.delete(playlistId);
        else copy.add(playlistId);
        return copy;
      });
      setError(getApiErrorMessage(err, 'Could not update playlist.'));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['playlists', 'containing', videoId] });
      void qc.invalidateQueries({ queryKey: ['watch-later'] });
    },
  });

  const createPlaylist = useMutation({
    mutationFn: async ({ title, description }: { title: string; description?: string }) => {
      const { data } = await api.post<{ data: Playlist }>('/playlists', {
        title,
        visibility: 'private',
        ...(description ? { description } : {}),
      });
      const playlist = data.data;
      await api.post(`/playlists/${playlist.id}/videos`, { videoId });
      return playlist;
    },
    onSuccess: (playlist) => {
      setNewTitle('');
      setNewDescription('');
      setShowCreateDetails(false);
      setSelected((prev) => new Set(prev).add(playlist.id));
      void qc.invalidateQueries({ queryKey: ['playlists', 'me'] });
      void qc.invalidateQueries({ queryKey: ['playlists', 'containing', videoId] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not create playlist.'));
    },
  });

  const playlists = playlistsQuery.data ?? [];

  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId} size="md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={titleId} className="font-display-forge text-lg font-semibold">
          Save to…
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container-high"
          aria-label="Close"
        >
          <Icon name="close" />
        </button>
      </div>

      {playlistsQuery.isLoading || containingQuery.isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading playlists…</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {playlists.map((pl) => {
            const checked = selected.has(pl.id);
            return (
              <li key={pl.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-container-high">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={toggle.isPending}
                    onChange={() => toggle.mutate({ playlistId: pl.id, next: !checked })}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">
                    {pl.title}
                  </span>
                  {pl.systemType === 'watch_later' ? (
                    <Icon name="watch_later" className="text-sm text-outline" />
                  ) : pl.visibility === 'private' ? (
                    <Icon name="lock" className="text-sm text-outline" />
                  ) : pl.visibility === 'unlisted' ? (
                    <Icon name="link" className="text-sm text-outline" />
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 border-t border-outline-variant/20 pt-4">
        <label className="block text-sm">
          <span className="font-label-caps text-xs text-outline">New playlist</span>
          <div className="mt-1 flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={100}
              placeholder="Playlist title"
              className="min-w-0 flex-1 rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={createPlaylist.isPending || newTitle.trim().length < 1}
              onClick={() =>
                createPlaylist.mutate({
                  title: newTitle.trim(),
                  description: newDescription.trim() || undefined,
                })
              }
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </label>
        {showCreateDetails ? (
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Description (optional)"
            className="mt-2 w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm"
            aria-label="Playlist description"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowCreateDetails(true)}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Add description
          </button>
        )}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <Link
        href={`/playlists/new?videoId=${videoId}`}
        className="mt-4 inline-block text-sm text-primary hover:underline"
        onClick={onClose}
      >
        Open full create form
      </Link>
    </Dialog>
  );
}
