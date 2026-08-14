'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Icon, PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';
import { Stream } from '@/types';

type Analytics = {
  peakViewers: number;
  avgViewers: number;
  uniqueViewers: number;
  totalChatMessages: number;
  superChatRevenueCents: number;
  ticketRevenueCents: number;
  ticketSalesCount: number;
  totalPollVotes: number;
  durationSeconds: number;
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function StudioPostStreamDebriefPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { user, isCreator } = useAuth();
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');

  const { data: stream, isLoading, isError } = useQuery({
    queryKey: ['stream', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get<{ data: Stream }>(`/streams/${id}`);
      return data.data;
    },
  });

  const isOwner = !!user && !!stream && stream.userId === user.id;

  const { data: analytics } = useQuery({
    queryKey: ['stream-analytics', id],
    enabled: !!id && isOwner,
    queryFn: async () => {
      const { data } = await api.get<{ data: Analytics }>(
        `/creators/me/streams/${id}/analytics`,
      );
      return data.data;
    },
  });

  const { data: replay } = useQuery({
    queryKey: ['stream-replay', id],
    enabled: !!id && stream?.status === 'ended',
    queryFn: async () => {
      const { data } = await api.get<{
        data: { id: string; title: string; accessDenied?: boolean } | null;
      }>(`/streams/${id}/replay`);
      return data.data;
    },
  });

  const summaryMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get<{
        data: { summary: string; highlights?: string[] };
      }>(`/streams/${id}/ai-summary`);
      return data.data.summary;
    },
    onSuccess: (text) => {
      setError('');
      setSummary(text);
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not generate stream summary.')),
  });

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="space-y-4">
        <p className="text-sm text-on-surface-variant">Loading debrief…</p>
      </main>
    );
  }

  if (isError || !stream || !isOwner) {
    return (
      <main className="space-y-4">
        <PageHeader title="Post-stream debrief" subtitle="Session summary unavailable." />
        <Link href="/studio/live" className="text-sm text-primary hover:underline">
          Back to Go live
        </Link>
      </main>
    );
  }

  const duration =
    analytics?.durationSeconds ??
    (stream.startedAt && stream.endedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(stream.endedAt).getTime() - new Date(stream.startedAt).getTime()) / 1000,
          ),
        )
      : 0);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Post-stream debrief"
          subtitle="Review performance, grab the replay, and capture takeaways."
        />
        <Link href="/studio/live" className="text-sm text-primary hover:underline">
          Back to Go live
        </Link>
      </div>

      <section className="glass-panel space-y-4 rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            tone={stream.status === 'ended' ? 'neutral' : 'live'}
            label={stream.status === 'ended' ? 'Ended' : stream.status.toUpperCase()}
          />
          {stream.endReason ? (
            <StatusPill
              tone={stream.endReason === 'connection_lost' ? 'warning' : 'neutral'}
              label={stream.endReason === 'connection_lost' ? 'Connection lost' : 'Host ended'}
            />
          ) : null}
        </div>
        <h2 className="text-xl font-semibold">{stream.title}</h2>
        <p className="text-sm text-on-surface-variant">
          {stream.description?.trim() || 'No description provided for this session.'}
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          {replay && !replay.accessDenied ? (
            <Link
              href={`/watch/${replay.id}`}
              className="primary-button inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold text-on-primary"
            >
              <Icon name="play_circle" />
              Watch replay
            </Link>
          ) : (
            <p className="text-sm text-on-surface-variant">
              {stream.recordEnabled
                ? 'Replay is processing — check back shortly.'
                : 'Recording was disabled for this session.'}
            </p>
          )}
          <Link
            href={`/live/${stream.id}`}
            className="rounded-full border border-outline-variant/40 px-4 py-2 hover:border-primary"
          >
            Open live room
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Duration', value: formatDuration(duration) },
          { label: 'Peak viewers', value: String(analytics?.peakViewers ?? stream.viewerCount ?? 0) },
          { label: 'Unique viewers', value: String(analytics?.uniqueViewers ?? '—') },
          { label: 'Chat messages', value: String(analytics?.totalChatMessages ?? '—') },
          {
            label: 'Super chats',
            value: `$${((analytics?.superChatRevenueCents ?? 0) / 100).toFixed(2)}`,
          },
          {
            label: 'Ticket sales',
            value: `${analytics?.ticketSalesCount ?? 0} · $${((analytics?.ticketRevenueCents ?? 0) / 100).toFixed(2)}`,
          },
          { label: 'Poll votes', value: String(analytics?.totalPollVotes ?? '—') },
          { label: 'Avg viewers', value: String(analytics?.avgViewers ?? '—') },
        ].map((metric) => (
          <div key={metric.label} className="glass-panel rounded-2xl p-4">
            <p className="font-label-caps text-xs text-outline">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
          </div>
        ))}
      </section>

      <section className="glass-panel space-y-4 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-label-caps text-xs text-outline">AI takeaways</p>
            <h2 className="mt-1 text-lg font-semibold">Session summary</h2>
          </div>
          <button
            type="button"
            disabled={summaryMutation.isPending}
            onClick={() => summaryMutation.mutate()}
            className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:border-primary disabled:opacity-50"
          >
            {summaryMutation.isPending ? 'Generating…' : summary ? 'Regenerate' : 'Generate summary'}
          </button>
        </div>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        {summary ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 text-sm whitespace-pre-wrap text-on-surface-variant">
            {summary}
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Generate an AI summary from chat highlights and session context for your next stream.
          </p>
        )}
      </section>
    </main>
  );
}
