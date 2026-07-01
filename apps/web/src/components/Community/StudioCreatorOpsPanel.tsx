'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@forge/design-system';
import { api } from '@/lib/api';

interface Props {
  communityId: string;
}

type AuditLog = {
  id: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  createdAt: string;
};

type Room = { id: string; name: string; roomType: string };

type CopilotInsights = {
  summary: string;
  recommendations: string[];
  growthFocus: string;
  provider: 'claude' | 'deterministic';
};

type BusinessAnalytics = {
  membership: { activeSubscribers: number; mrrCents: number; churnRate: number };
  engagement: { engagementScore: number };
};

export function StudioCreatorOpsPanel({ communityId }: Props) {
  const [moderationText, setModerationText] = useState('');
  const [moderationResult, setModerationResult] = useState<string | null>(null);
  const [summaryRoomId, setSummaryRoomId] = useState('');
  const [roomSummary, setRoomSummary] = useState<string | null>(null);
  const [copilotInsights, setCopilotInsights] = useState<CopilotInsights | null>(null);

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ['creator-audit-logs'],
    queryFn: async () => {
      const { data } = await api.get<{ data: AuditLog[] }>('/creators/me/audit-logs?limit=30');
      return data.data ?? [];
    },
  });

  const { data: rooms } = useQuery({
    queryKey: ['community-rooms', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Room[] }>(`/communities/${communityId}/rooms`);
      return (data.data ?? []).filter((r) => r.roomType === 'text');
    },
  });

  const scoreMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{
        data: { score: number; flagged: boolean; reasons: string[]; model: string };
      }>('/creators/me/ai/moderation/score', { text: moderationText.trim() });
      return data.data;
    },
    onSuccess: (result) => {
      setModerationResult(
        `Score ${Math.round(result.score * 100)}% · ${result.flagged ? 'flagged' : 'ok'} · ${result.model} · ${result.reasons.join(', ') || 'clean'}`,
      );
    },
  });

  const summaryMutation = useMutation({
    mutationFn: async (roomId: string) => {
      const { data } = await api.get<{ data: { summary: string } }>(
        `/creators/me/communities/${communityId}/rooms/${roomId}/summary`,
      );
      return data.data.summary;
    },
    onSuccess: (summary) => setRoomSummary(summary),
  });

  const copilotMutation = useMutation({
    mutationFn: async () => {
      const bizRes = await api.get<{ data: BusinessAnalytics }>(
        '/communities/creators/me/business-analytics',
      );
      const biz = bizRes.data.data;
      const { data } = await api.post<{ data: CopilotInsights }>(
        '/creators/me/copilot/insights',
        {
          totalSubscribers: biz.membership.activeSubscribers,
          mrr: biz.membership.mrrCents / 100,
          churnRate: biz.membership.churnRate,
          videoViews: 0,
          communityEngagement: biz.engagement.engagementScore,
        },
      );
      return data.data;
    },
    onSuccess: (insights) => setCopilotInsights(insights),
  });

  return (
    <div className="space-y-6">
      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-xs text-outline">Creator copilot</h2>
        <p className="text-xs text-on-surface-variant">
          AI-powered insights and growth recommendations based on your current metrics.
        </p>
        <Button disabled={copilotMutation.isPending} onClick={() => copilotMutation.mutate()}>
          {copilotMutation.isPending ? 'Analyzing…' : 'Get AI insights'}
        </Button>
        {copilotMutation.isError ? (
          <p className="text-xs text-error">Failed to load insights. Try again.</p>
        ) : null}
        {copilotInsights ? (
          <div className="space-y-3 rounded-lg bg-surface-container-low p-4">
            <p className="text-sm text-on-surface">{copilotInsights.summary}</p>
            {copilotInsights.growthFocus ? (
              <p className="rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                Focus: {copilotInsights.growthFocus}
              </p>
            ) : null}
            {copilotInsights.recommendations.length > 0 ? (
              <ul className="space-y-1">
                {copilotInsights.recommendations.map((rec, i) => (
                  <li key={i} className="flex gap-2 text-xs text-on-surface-variant">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {rec}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-right text-[10px] text-outline">
              via {copilotInsights.provider === 'claude' ? 'Claude AI' : 'FORGE analytics'}
            </p>
          </div>
        ) : null}
      </section>

      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-xs text-outline">AI moderation preview</h2>
        <textarea
          value={moderationText}
          onChange={(e) => setModerationText(e.target.value)}
          placeholder="Paste message text to score before publishing"
          rows={3}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
        />
        <Button
          disabled={!moderationText.trim() || scoreMutation.isPending}
          onClick={() => scoreMutation.mutate()}
        >
          Score content
        </Button>
        {moderationResult ? (
          <p className="text-xs text-on-surface-variant">{moderationResult}</p>
        ) : null}
      </section>

      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-xs text-outline">Text room summary</h2>
        <select
          className="w-full rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm"
          value={summaryRoomId}
          onChange={(e) => setSummaryRoomId(e.target.value)}
        >
          <option value="">Select text room</option>
          {(rooms ?? []).map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
        <Button
          disabled={!summaryRoomId || summaryMutation.isPending}
          onClick={() => summaryMutation.mutate(summaryRoomId)}
        >
          Summarize discussion
        </Button>
        {roomSummary ? (
          <pre className="whitespace-pre-wrap rounded-lg bg-surface-container-low p-3 text-xs text-on-surface-variant">
            {roomSummary}
          </pre>
        ) : null}
      </section>

      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-xs text-outline">Audit log</h2>
        {auditLoading ? (
          <p className="text-xs text-on-surface-variant">Loading…</p>
        ) : (auditLogs ?? []).length === 0 ? (
          <p className="text-xs text-on-surface-variant">No audit events yet.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
            {(auditLogs ?? []).map((log) => (
              <li key={log.id} className="rounded-lg border border-outline-variant/30 px-3 py-2">
                <p className="font-medium">{log.action}</p>
                <p className="text-on-surface-variant">
                  {log.resourceType ?? '—'}
                  {log.resourceId ? ` · ${log.resourceId.slice(0, 8)}` : ''} ·{' '}
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
