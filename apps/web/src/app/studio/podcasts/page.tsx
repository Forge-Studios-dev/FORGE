'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState, Icon, ListSkeleton, PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';
import { getMyVideos } from '@/lib/creator-studio';

type PodcastSeries = {
  id: string;
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  category?: string | null;
  language?: string | null;
  rssEnabled?: boolean;
  createdAt: string;
};

type Episode = {
  id: string;
  title: string;
  episodeNumber?: number | null;
  season?: number | null;
  durationSeconds?: number | null;
};

export default function StudioPodcastsPage() {
  const { isCreator, user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [attachSeriesId, setAttachSeriesId] = useState<string | null>(null);
  const [attachVideoId, setAttachVideoId] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [attachError, setAttachError] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['studio-podcasts'],
    enabled: isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: PodcastSeries[] } }>('/creators/me/podcasts');
      return data.data?.data ?? [];
    },
  });

  const { data: episodes = [], isLoading: episodesLoading } = useQuery({
    queryKey: ['studio-podcast-episodes', attachSeriesId],
    enabled: !!attachSeriesId,
    queryFn: async () => {
      const { data } = await api.get<{ data: { episodes: Episode[] } }>(
        `/podcasts/${attachSeriesId}/episodes`,
      );
      return data.data?.episodes ?? [];
    },
  });

  const { data: attachableVideos = [] } = useQuery({
    queryKey: ['studio-podcast-attachable-videos', user?.id],
    enabled: isCreator && !!attachSeriesId,
    queryFn: async () => {
      const videos = await getMyVideos(user?.id);
      return videos.filter((v) => v.status === 'ready');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/creators/me/podcasts', {
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
      });
    },
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setCategory('');
      setError('');
      void qc.invalidateQueries({ queryKey: ['studio-podcasts'] });
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not create podcast series.')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (seriesId: string) => {
      await api.delete(`/creators/me/podcasts/${seriesId}`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['studio-podcasts'] }),
  });

  const attachMutation = useMutation({
    mutationFn: async () => {
      if (!attachSeriesId || !attachVideoId) return;
      await api.post(`/creators/me/podcasts/${attachSeriesId}/episodes`, {
        videoId: attachVideoId,
        episodeNumber: episodeNumber.trim() ? Number(episodeNumber) : undefined,
      });
    },
    onSuccess: () => {
      setAttachVideoId('');
      setEpisodeNumber('');
      setAttachError('');
      void qc.invalidateQueries({ queryKey: ['studio-podcast-episodes', attachSeriesId] });
    },
    onError: (e) => setAttachError(getApiErrorMessage(e, 'Could not attach episode.')),
  });

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <PageHeader title="Podcasts" subtitle="Creator access required." />
      </main>
    );
  }

  const activeSeries = data?.find((s) => s.id === attachSeriesId) ?? null;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Podcasts"
        subtitle="Create series, attach lesson videos as episodes, and publish audio learning paths."
      />

      <section className="glass-panel space-y-4 rounded-2xl p-6">
        <div>
          <p className="font-label-caps text-xs text-outline">New series</p>
          <h2 className="mt-1 text-lg font-semibold">Start a podcast series</h2>
        </div>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Series title"
          className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          rows={3}
          className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (optional)"
          className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          disabled={!title.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="primary-button inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          <Icon name="add" />
          {createMutation.isPending ? 'Creating…' : 'Create series'}
        </button>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Your series</h2>
          <Link href="/podcasts" className="text-sm text-primary hover:underline">
            Browse public podcasts
          </Link>
        </div>

        {isLoading ? <ListSkeleton rows={4} /> : null}
        {isError ? <p className="text-sm text-error">Failed to load podcast series.</p> : null}

        {!isLoading && !isError && !(data?.length ?? 0) ? (
          <EmptyState
            icon="podcasts"
            title="No podcast series yet"
            description="Create a series, then attach existing Studio videos as episodes."
            action={{ label: 'Upload a lesson', href: '/upload' }}
          />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {(data ?? []).map((series) => (
            <article key={series.id} className="glass-panel rounded-2xl p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{series.title}</h3>
                  {series.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">{series.description}</p>
                  ) : null}
                </div>
                <StatusPill
                  tone={series.rssEnabled ? 'success' : 'neutral'}
                  label={series.rssEnabled ? 'RSS on' : 'Draft'}
                />
              </div>
              <p className="text-xs text-outline">
                {series.category ? `${series.category} · ` : ''}
                Created {new Date(series.createdAt).toLocaleDateString()}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAttachSeriesId(series.id);
                    setAttachVideoId('');
                    setEpisodeNumber('');
                    setAttachError('');
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Manage episodes
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete “${series.title}”? Episodes will be detached.`)) {
                      deleteMutation.mutate(series.id);
                    }
                  }}
                  className="text-sm text-error hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {attachSeriesId && activeSeries ? (
        <section className="glass-panel space-y-4 rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-label-caps text-xs text-outline">Episodes</p>
              <h2 className="mt-1 text-lg font-semibold">{activeSeries.title}</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Attach a ready Studio video to this series.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAttachSeriesId(null)}
              className="text-sm text-on-surface-variant hover:underline"
            >
              Close
            </button>
          </div>

          {attachError ? <p className="text-sm text-error">{attachError}</p> : null}

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
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
            <input
              value={episodeNumber}
              onChange={(e) => setEpisodeNumber(e.target.value)}
              placeholder="Ep #"
              inputMode="numeric"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm"
            />
            <button
              type="button"
              disabled={!attachVideoId || attachMutation.isPending}
              onClick={() => attachMutation.mutate()}
              className="primary-button inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              {attachMutation.isPending ? 'Attaching…' : 'Attach'}
            </button>
          </div>

          {episodesLoading ? <ListSkeleton rows={3} /> : null}
          {!episodesLoading && episodes.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No episodes attached yet.</p>
          ) : null}
          <ul className="space-y-2">
            {episodes.map((episode) => (
              <li
                key={episode.id}
                className="flex items-center justify-between rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm"
              >
                <span className="font-medium">{episode.title}</span>
                <span className="text-xs text-outline">
                  {episode.episodeNumber != null ? `Ep ${episode.episodeNumber}` : 'Episode'}
                  {episode.durationSeconds
                    ? ` · ${Math.round(episode.durationSeconds / 60)} min`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
