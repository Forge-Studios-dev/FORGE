'use client';

import { useQuery } from '@tanstack/react-query';
import { EmptyState, Icon, ListSkeleton, PageHeader, buttonClassName } from '@forge/design-system';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useSkillFeatures } from '@/hooks/useSkillFeatures';

type CopilotInsights = {
  summary: string;
  recommendations: string[];
  growthFocus: string;
};

export default function StudioCopilotPage() {
  const { user, isCreator } = useAuth();
  const { creatorInsightsEnabled, isLoading: flagsLoading } = useSkillFeatures();

  const insightsQuery = useQuery({
    queryKey: ['studio-copilot-insights', user?.id],
    enabled: !!user?.id && isCreator && creatorInsightsEnabled,
    queryFn: async () => {
      const { data: analyticsEnvelope } = await api.get<{
        data: {
          membership?: { active?: number; mrrCents?: number };
          kpis?: { churnRate30d?: number; engagementScore?: number };
        };
      }>('/creators/me/business-analytics');
      const analytics = analyticsEnvelope.data ?? {};
      const membership = analytics.membership ?? {};
      const kpis = analytics.kpis ?? {};

      const { data: insightEnvelope } = await api.post<{ data: CopilotInsights }>(
        '/creators/me/copilot/insights',
        {
          totalSubscribers: membership.active ?? 0,
          mrr: ((membership.mrrCents as number | undefined) ?? 0) / 100,
          churnRate: kpis.churnRate30d ?? 0,
          videoViews: 0,
          communityEngagement: kpis.engagementScore ?? 0,
        },
      );
      return insightEnvelope.data;
    },
  });

  if (!flagsLoading && !creatorInsightsEnabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Copilot" subtitle="Channel insights powered by FORGE AI." />
        <EmptyState
          title="Copilot is not enabled"
          description="Turn on AI_CLAUDE_ENABLED with an Anthropic API key on the API to unlock creator insights."
          action={{ label: 'Open analytics', href: '/studio/analytics' }}
        />
      </div>
    );
  }

  if (!isCreator) {
    return (
      <EmptyState
        title="Creator access required"
        description="Approve as a creator to use Studio Copilot."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="AI Copilot"
          subtitle="Summary and priorities from your membership and engagement signals."
        />
        <button
          type="button"
          className={buttonClassName('secondary')}
          onClick={() => void insightsQuery.refetch()}
          disabled={insightsQuery.isFetching}
        >
          <Icon name="refresh" />
          {insightsQuery.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {insightsQuery.isLoading || flagsLoading ? <ListSkeleton rows={4} /> : null}

      {insightsQuery.isError ? (
        <div className="space-y-4">
          <EmptyState
            title="Could not load insights"
            description="Check your connection and try again."
          />
          <button
            type="button"
            className={buttonClassName('primary')}
            onClick={() => void insightsQuery.refetch()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {insightsQuery.data ? (
        <div className="space-y-6">
          <section className="glass-panel rounded-2xl p-5">
            <h2 className="font-display-forge text-lg font-semibold">Summary</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-on-surface">
              {insightsQuery.data.summary?.trim() || 'No summary available.'}
            </p>
          </section>

          {insightsQuery.data.growthFocus?.trim() ? (
            <section className="glass-panel rounded-2xl p-5">
              <h2 className="font-display-forge text-lg font-semibold">Top priority</h2>
              <p className="mt-3 text-sm leading-relaxed text-on-surface">
                {insightsQuery.data.growthFocus}
              </p>
            </section>
          ) : null}

          {insightsQuery.data.recommendations?.length ? (
            <section className="glass-panel rounded-2xl p-5">
              <h2 className="font-display-forge text-lg font-semibold">Recommendations</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-on-surface">
                {insightsQuery.data.recommendations.map((rec) => (
                  <li key={rec}>{rec}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
