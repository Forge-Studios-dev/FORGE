'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Stream, Category } from '@/types';

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'followers', label: 'Followers only' },
  { value: 'subscribers', label: 'Members only' },
  { value: 'tier', label: 'Tier members' },
] as const;

export default function StudioLivePage() {
  const { isCreator } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<string>('public');
  const [categoryId, setCategoryId] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [recordEnabled, setRecordEnabled] = useState(true);
  const [ageRestricted, setAgeRestricted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const { data: streams, refetch } = useQuery({
    queryKey: ['live-streams'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Stream[] }>('/streams/live');
      return data.data;
    },
    refetchInterval: 15_000,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Category[] }>('/categories');
      return data.data;
    },
  });

  async function startStream() {
    const t = title.trim();
    if (!t) return;
    setError('');
    setCreating(true);
    try {
      const { data } = await api.post<{ data: Stream }>('/streams/start', {
        title: t,
        description: description.trim() || undefined,
        visibility,
        categoryId: categoryId || undefined,
        chatEnabled,
        recordEnabled,
        ageRestricted,
      });
      setTitle('');
      await refetch();
      window.location.href = `/live/${data.data.id}`;
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof m === 'string' ? m : 'Could not start stream. Verify creator approval and email.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader title="Go live" subtitle="Teach skills in real time with OBS" />

      {isCreator ? (
        <section className="glass-panel mb-8 space-y-4 rounded-xl p-6">
          <h2 className="font-label-caps text-outline">Start a session</h2>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Session title"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2.5 outline-none focus:border-primary"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2.5 outline-none focus:border-primary"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-on-surface-variant">Visibility</span>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2"
              >
                {VISIBILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-on-surface-variant">Category</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2"
              >
                <option value="">None</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={chatEnabled} onChange={(e) => setChatEnabled(e.target.checked)} />
              Chat enabled
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={recordEnabled} onChange={(e) => setRecordEnabled(e.target.checked)} />
              Record VOD
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ageRestricted}
                onChange={(e) => setAgeRestricted(e.target.checked)}
              />
              Age restricted
            </label>
          </div>
          <button
            type="button"
            disabled={creating || title.trim().length < 3}
            onClick={() => void startStream()}
            className="primary-button inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-40"
          >
            <Icon name="sensors" />
            {creating ? 'Starting…' : 'Go live'}
          </button>
        </section>
      ) : (
        <p className="mb-8 text-sm text-on-surface-variant">
          Creator approval required.{' '}
          <Link href="/upload/become-creator" className="text-primary hover:underline">
            Apply to become a creator
          </Link>
        </p>
      )}

      <h2 className="font-display-forge mb-4 text-lg font-semibold">Live now</h2>
      {streams?.length ? (
        <ul className="space-y-3">
          {streams.map((s) => (
            <li key={s.id}>
              <Link
                href={`/live/${s.id}`}
                className="glass-panel flex items-center justify-between rounded-xl p-4 hover:border-primary/30"
              >
                <span className="font-medium">{s.title}</span>
                <span className="text-xs text-error">LIVE</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-on-surface-variant">No live sessions right now.</p>
      )}

      <Link href="/live" className="mt-6 inline-block text-sm text-primary hover:underline">
        Browse all live sessions →
      </Link>
    </main>
  );
}
