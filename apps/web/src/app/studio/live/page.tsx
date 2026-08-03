'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon, PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';
import { Stream, Category, SubscriptionTier } from '@/types';
import { useLiveStreamsQuery, useUpcomingStreamsQuery } from '@/hooks/useLiveStreamsQuery';

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', desc: 'Anyone can join' },
  { value: 'followers', label: 'Subscribers only', desc: 'People who subscribed to your channel' },
  { value: 'subscribers', label: 'Members only', desc: 'Active membership required' },
  { value: 'tier', label: 'Tier members', desc: 'Specific membership tier' },
  { value: 'private', label: 'Private', desc: 'Invite-only session' },
  { value: 'paid_event', label: 'Paid event', desc: 'Ticket purchase required' },
] as const;

export default function StudioLivePage() {
  const { canGoLive, user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<string>('public');
  const [requiredTierId, setRequiredTierId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [recordEnabled, setRecordEnabled] = useState(true);
  const [dvrEnabled, setDvrEnabled] = useState(false);
  const [ageRestricted, setAgeRestricted] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [ticketPriceCents, setTicketPriceCents] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const { data: streams, refetch } = useLiveStreamsQuery();
  const { data: upcoming } = useUpcomingStreamsQuery();

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Category[] }>('/categories');
      return data.data;
    },
  });

  const { data: myTiers } = useQuery({
    queryKey: ['studio-tiers', user?.id],
    enabled: canGoLive && !!user?.id,
    queryFn: async () => {
      const { data } = await api.get<{ data: SubscriptionTier[] }>(`/creators/${user!.id}/tiers`);
      return data.data;
    },
  });

  const { data: myCommunities } = useQuery({
    queryKey: ['studio-communities', user?.id],
    enabled: canGoLive && !!user?.id,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: string; name: string; slug: string }>;
      }>(`/creators/${user!.id}/communities`);
      return data.data;
    },
  });

  const { data: recentEnded = [] } = useQuery({
    queryKey: ['studio-recent-ended-streams', user?.id],
    enabled: canGoLive && !!user?.id,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{
          id: string;
          title: string;
          endedAt: string | null;
          uniqueViewerCount: number;
        }>;
      }>('/creators/me/streams/recent');
      return data.data ?? [];
    },
  });

  async function startStream() {
    const t = title.trim();
    if (!t) return;
    if (visibility === 'tier' && !requiredTierId) {
      setError('Select a membership tier for tier-only streams.');
      return;
    }
    if (visibility === 'paid_event') {
      const cents = Number(ticketPriceCents);
      if (!Number.isFinite(cents) || cents < 100) {
        setError('Paid events need a ticket price of at least $1.00.');
        return;
      }
    }
    setError('');
    setCreating(true);
    try {
      const { data } = await api.post<{ data: Stream }>('/streams/start', {
        title: t,
        description: description.trim() || undefined,
        visibility,
        requiredTierId: visibility === 'tier' ? requiredTierId : undefined,
        categoryId: categoryId || undefined,
        chatEnabled,
        recordEnabled,
        dvrEnabled,
        ageRestricted,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        ticketPriceCents: visibility === 'paid_event' ? Number(ticketPriceCents) : undefined,
        communityId: communityId || undefined,
      });
      setTitle('');
      await refetch();
      window.location.href = `/live/${data.data.id}`;
    } catch (e: unknown) {
      setError(
        getApiErrorMessage(
          e,
          'Could not start stream. Verify creator approval, email verification, and Mux configuration.',
        ),
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Go live"
        subtitle="Set up your session, choose who can join, then open the host control room."
      />

      {canGoLive ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
          <div className="glass-panel space-y-5 rounded-2xl p-6">
            <div>
              <p className="font-label-caps text-xs text-outline">Stream details</p>
              <h2 className="mt-1 text-lg font-semibold">Session setup</h2>
            </div>
            {error ? <p className="text-sm text-error">{error}</p> : null}

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title (min 3 characters)"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 outline-none focus:border-primary"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will you teach live?"
              rows={3}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 outline-none focus:border-primary"
            />

            <div>
              <p className="mb-2 text-sm text-on-surface-variant">Visibility</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {VISIBILITY_OPTIONS.map((option) => {
                  const active = visibility === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setVisibility(option.value);
                        if (option.value !== 'tier') setRequiredTierId('');
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-outline-variant/30 bg-surface-container-low hover:border-primary/30'
                      }`}
                    >
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="mt-1 block text-xs text-on-surface-variant">{option.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {visibility === 'tier' ? (
                <label className="block text-sm">
                  <span className="text-on-surface-variant">Required tier</span>
                  <select
                    value={requiredTierId}
                    onChange={(e) => setRequiredTierId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5"
                  >
                    <option value="">Select tier</option>
                    {(myTiers ?? []).map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {visibility === 'paid_event' ? (
                <label className="block text-sm">
                  <span className="text-on-surface-variant">Ticket price (USD cents)</span>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={ticketPriceCents}
                    onChange={(e) => setTicketPriceCents(e.target.value)}
                    placeholder="e.g. 999 for $9.99"
                    className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5"
                  />
                </label>
              ) : null}
              <label className="block text-sm">
                <span className="text-on-surface-variant">Schedule (optional)</span>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5"
                />
              </label>
              <label className="block text-sm">
                <span className="text-on-surface-variant">Category</span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5"
                >
                  <option value="">None</option>
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-on-surface-variant">Community (optional)</span>
                <select
                  value={communityId}
                  onChange={(e) => setCommunityId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5"
                >
                  <option value="">No community link</option>
                  {(myCommunities ?? []).map((c) => (
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
              <label className="flex items-center gap-2" title="Longer rewind buffer; slightly higher latency">
                <input type="checkbox" checked={dvrEnabled} onChange={(e) => setDvrEnabled(e.target.checked)} />
                Live DVR
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
          </div>

          <aside className="space-y-4">
            <div className="glass-panel rounded-2xl p-6">
              <p className="font-label-caps text-xs text-outline">Preview</p>
              <h2 className="mt-1 text-lg font-semibold">{title.trim() || 'Untitled session'}</h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                {description.trim() || 'Add a short description so viewers know what to expect.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill tone="live" label={scheduledAt ? 'Scheduled' : 'Ready to go live'} />
                <StatusPill
                  tone="neutral"
                  label={VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.label ?? visibility}
                />
              </div>
              <button
                type="button"
                disabled={creating || title.trim().length < 3}
                onClick={() => void startStream()}
                className="primary-button mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-on-primary disabled:opacity-40"
              >
                <Icon name="sensors" />
                {creating ? 'Starting…' : scheduledAt ? 'Schedule & open room' : 'Go live'}
              </button>
              <p className="mt-3 text-xs text-on-surface-variant">
                After start, you will land in the host control room with chat, polls, Q&A, and RTMP details.
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6">
              <p className="font-label-caps text-xs text-outline">Connection</p>
              <h3 className="mt-1 font-semibold">Browser or OBS</h3>
              <p className="mt-2 text-sm text-on-surface-variant">
                Start from Studio for browser hosting, or use the stream key shown in the live room for OBS/RTMP.
              </p>
              <p className="mt-3 text-xs text-outline">Tip: test your setup before a scheduled event.</p>
            </div>
          </aside>
        </section>
      ) : (
        <section className="glass-panel rounded-2xl p-6">
          <p className="text-sm text-on-surface-variant">
            Creator approval required.{' '}
            <Link href="/upload/become-creator" className="text-primary hover:underline">
              Apply to become a creator
            </Link>
          </p>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Live now</h2>
          <Link href="/live" className="text-sm text-primary hover:underline">
            Browse all live sessions
          </Link>
        </div>
        {streams?.length ? (
          <ul className="space-y-3">
            {streams.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/live/${s.id}`}
                  className="glass-panel flex items-center justify-between rounded-2xl p-4 hover:border-primary/30"
                >
                  <span className="font-medium">{s.title}</span>
                  <StatusPill tone="live" label="LIVE" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-on-surface-variant">No live sessions right now.</p>
        )}
      </section>

      {upcoming?.length ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Scheduled</h2>
          <ul className="space-y-3">
            {upcoming.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/live/${s.id}`}
                  className="glass-panel flex items-center justify-between rounded-2xl p-4 hover:border-primary/30"
                >
                  <span>
                    <span className="block font-medium">{s.title}</span>
                    {s.scheduledAt ? (
                      <span className="mt-1 block text-xs text-on-surface-variant">
                        {new Date(s.scheduledAt).toLocaleString()}
                      </span>
                    ) : null}
                  </span>
                  <StatusPill tone="neutral" label="Scheduled" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recentEnded.length ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Recent sessions</h2>
          <ul className="space-y-3">
            {recentEnded.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/studio/live/${s.id}/debrief`}
                  className="glass-panel flex items-center justify-between rounded-2xl p-4 hover:border-primary/30"
                >
                  <span>
                    <span className="block font-medium">{s.title}</span>
                    <span className="mt-1 block text-xs text-on-surface-variant">
                      {s.endedAt ? `Ended ${new Date(s.endedAt).toLocaleString()}` : 'Ended'}
                      {s.uniqueViewerCount
                        ? ` · ${s.uniqueViewerCount} unique viewer${s.uniqueViewerCount === 1 ? '' : 's'}`
                        : ''}
                    </span>
                  </span>
                  <StatusPill tone="primary" label="Debrief" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="glass-panel rounded-2xl p-5 text-sm text-on-surface-variant">
        After you end a live session, Studio opens the{' '}
        <span className="text-on-surface">post-stream debrief</span> with replay links, metrics, and an
        AI summary. Recent ended sessions also appear above for quick re-entry.
      </section>
    </main>
  );
}
