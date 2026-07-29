'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { EmptyState, Icon, ListSkeleton, PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';
import { getMyVideos } from '@/lib/creator-studio';

type Community = { id: string; name: string; slug: string };
type Room = { id: string; name: string; roomType?: string; type?: string };
type ModerationScore = {
  score: number;
  flagged: boolean;
  reasons: string[];
  model?: string;
};
type Insights = {
  summary: string;
  recommendations: string[];
  growthFocus: string;
  provider: 'claude' | 'deterministic';
};
type AuditLog = {
  id: string;
  action?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export default function StudioAiCopilotPage() {
  const { user, isCreator } = useAuth();
  const [communityId, setCommunityId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [draftText, setDraftText] = useState('');
  const [scoreResult, setScoreResult] = useState<ModerationScore | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [roomSummary, setRoomSummary] = useState('');
  const [error, setError] = useState('');

  const { data: communities } = useQuery({
    queryKey: ['studio-communities', user?.id],
    enabled: isCreator && !!user?.id,
    queryFn: async () => {
      const { data } = await api.get<{ data: Community[] }>(`/creators/${user!.id}/communities`);
      return data.data;
    },
  });

  useEffect(() => {
    if (!communityId && communities?.length) setCommunityId(communities[0].id);
  }, [communities, communityId]);

  const { data: rooms } = useQuery({
    queryKey: ['studio-copilot-rooms', communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data } = await api.get<{ data: Room[] | { data: Room[] } }>(
        `/communities/${communityId}/rooms`,
      );
      const payload = data.data;
      const list = Array.isArray(payload) ? payload : payload?.data ?? [];
      return list.filter((r) => (r.roomType ?? r.type ?? 'text') === 'text');
    },
  });

  useEffect(() => {
    setRoomId('');
    setRoomSummary('');
  }, [communityId]);

  useEffect(() => {
    if (!roomId && rooms?.length) setRoomId(rooms[0].id);
  }, [rooms, roomId]);

  const { data: health } = useQuery({
    queryKey: ['studio-copilot-health', communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { score: number; tips?: string[]; label?: string };
      }>(`/creators/me/communities/${communityId}/copilot/health`);
      return data.data;
    },
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ['studio-audit-logs'],
    enabled: isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: AuditLog[] | { data: AuditLog[] } }>(
        '/creators/me/audit-logs?limit=20',
      );
      const payload = data.data;
      return Array.isArray(payload) ? payload : payload?.data ?? [];
    },
  });

  const scoreMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: ModerationScore }>('/creators/me/ai/moderation/score', {
        text: draftText,
      });
      return data.data;
    },
    onSuccess: (result) => {
      setError('');
      setScoreResult(result);
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not score content.')),
  });

  const insightsMutation = useMutation({
    mutationFn: async () => {
      const [subs, videos] = await Promise.all([
        api.get<{ data: { active: number; mrrCents: number } }>('/creators/me/subscribers/analytics'),
        getMyVideos(user?.id),
      ]);
      const ready = (videos ?? []).filter((v) => v.status === 'ready');
      const { data } = await api.post<{ data: Insights }>('/creators/me/copilot/insights', {
        totalSubscribers: subs.data.data.active ?? 0,
        mrr: (subs.data.data.mrrCents ?? 0) / 100,
        videoViews: ready.reduce((sum, v) => sum + (v.viewCount ?? 0), 0),
        topContentTitles: ready.slice(0, 3).map((v) => v.title),
      });
      return data.data;
    },
    onSuccess: (result) => {
      setError('');
      setInsights(result);
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not generate insights.')),
  });

  const summaryMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get<{
        data: { summary?: string; data?: { summary: string } };
      }>(`/creators/me/communities/${communityId}/rooms/${roomId}/summary`);
      const payload = data.data;
      return payload.summary ?? payload.data?.summary ?? '';
    },
    onSuccess: (summary) => {
      setError('');
      setRoomSummary(summary);
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not summarize room.')),
  });

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <PageHeader title="AI Copilot" subtitle="Creator access required." />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="AI Copilot"
        subtitle="Insights, moderation scoring, and community health tips for creator operations."
      />

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel space-y-4 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-label-caps text-xs text-outline">Insights</p>
              <h2 className="mt-1 text-lg font-semibold">Creator growth recommendations</h2>
            </div>
            <button
              type="button"
              disabled={insightsMutation.isPending}
              onClick={() => insightsMutation.mutate()}
              className="primary-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              <Icon name="auto_awesome" />
              {insightsMutation.isPending ? 'Analyzing…' : 'Get AI insights'}
            </button>
          </div>
          {insights ? (
            <div className="space-y-3">
              <StatusPill tone="primary" label={insights.growthFocus || insights.provider} />
              <p className="text-sm text-on-surface">{insights.summary}</p>
              <ul className="space-y-2">
                {insights.recommendations.map((tip) => (
                  <li
                    key={tip}
                    className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant"
                  >
                    {tip}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-outline">Source: {insights.provider}</p>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">
              Pulls your latest subscriber and content metrics, then returns growth focus tips.
            </p>
          )}
        </div>

        <div className="glass-panel space-y-4 rounded-2xl p-6">
          <div>
            <p className="font-label-caps text-xs text-outline">Moderation scoring</p>
            <h2 className="mt-1 text-lg font-semibold">Check a draft before you post</h2>
          </div>
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={5}
            placeholder="Paste a draft post, comment, or announcement…"
            className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={!draftText.trim() || scoreMutation.isPending}
            onClick={() => scoreMutation.mutate()}
            className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:border-primary disabled:opacity-50"
          >
            {scoreMutation.isPending ? 'Scoring…' : 'Analyze draft'}
          </button>
          {scoreResult ? (
            <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
              <div className="mb-2 flex items-center gap-2">
                <StatusPill
                  tone={scoreResult.flagged ? 'critical' : 'success'}
                  label={scoreResult.flagged ? 'Flagged' : 'Looks ok'}
                />
                <span className="text-sm text-on-surface-variant">
                  Risk {(scoreResult.score * 100).toFixed(0)}%
                </span>
              </div>
              {(scoreResult.reasons?.length ?? 0) > 0 ? (
                <p className="text-sm text-on-surface-variant">
                  Reasons: {scoreResult.reasons.join(', ')}
                </p>
              ) : (
                <p className="text-sm text-on-surface-variant">No spam/toxicity signals detected.</p>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="glass-panel space-y-4 rounded-2xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-label-caps text-xs text-outline">Community health</p>
            <h2 className="mt-1 text-lg font-semibold">Copilot health check</h2>
          </div>
          <label className="text-sm">
            Community
            <select
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              className="ml-2 rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2"
            >
              {(communities ?? []).length === 0 ? <option value="">No communities</option> : null}
              {(communities ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!communityId ? (
          <EmptyState
            icon="hub"
            title="Create a community first"
            description="Health scoring needs at least one community."
            action={{ label: 'Open communities', href: '/studio/communities' }}
          />
        ) : health ? (
          <div className="grid gap-4 md:grid-cols-[160px_1fr]">
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 text-center">
              <p className="text-sm text-on-surface-variant">Score</p>
              <p className="mt-2 text-4xl font-semibold text-primary">{health.score}</p>
            </div>
            <ul className="space-y-2">
              {(health.tips ?? ['Keep posting weekly and reply to new members within 24 hours.']).map(
                (tip) => (
                  <li
                    key={tip}
                    className="rounded-xl border border-outline-variant/30 px-3 py-2 text-sm text-on-surface-variant"
                  >
                    {tip}
                  </li>
                ),
              )}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">Loading health insights…</p>
        )}
      </section>

      <section className="glass-panel space-y-4 rounded-2xl p-6">
        <div>
          <p className="font-label-caps text-xs text-outline">Room summary</p>
          <h2 className="mt-1 text-lg font-semibold">Summarize a text room discussion</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Text room
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="ml-2 rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2"
            >
              {(rooms ?? []).length === 0 ? <option value="">No text rooms</option> : null}
              {(rooms ?? []).map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!communityId || !roomId || summaryMutation.isPending}
            onClick={() => summaryMutation.mutate()}
            className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:border-primary disabled:opacity-50"
          >
            {summaryMutation.isPending ? 'Generating…' : 'Generate summary'}
          </button>
          {roomSummary ? (
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(roomSummary)}
              className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:border-primary"
            >
              Copy summary
            </button>
          ) : null}
        </div>
        {roomSummary ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 text-sm whitespace-pre-wrap text-on-surface-variant">
            {roomSummary}
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Pulls recent room messages and returns highlights, topics, and suggested follow-ups.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent AI-assisted actions</h2>
        {auditLoading ? <ListSkeleton rows={3} /> : null}
        {!auditLoading && !(auditLogs?.length ?? 0) ? (
          <p className="text-sm text-on-surface-variant">No recent audit events.</p>
        ) : null}
        <ul className="space-y-2">
          {(auditLogs ?? []).slice(0, 8).map((log) => (
            <li key={log.id} className="glass-panel rounded-xl px-4 py-3 text-sm">
              <p className="font-medium">{log.action ?? 'Action'}</p>
              {log.createdAt ? (
                <p className="text-xs text-outline">{new Date(log.createdAt).toLocaleString()}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
