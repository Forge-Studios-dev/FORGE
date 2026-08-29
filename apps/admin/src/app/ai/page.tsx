'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader, StatCard } from '@forge/design-system';
import { api } from '@/lib/api';

type ModerationQueueCounts = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
};

type AiBudgetUsage = {
  used: number;
  budget: number;
  remaining: number;
  queue: ModerationQueueCounts;
};

function formatRemaining(remaining: number): string | number {
  return remaining === -1 ? 'Unlimited' : remaining;
}

export default function AiBudgetPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-ai-budget'],
    queryFn: async () => {
      const { data: body } = await api.get('/admin/ai/budget');
      return body.data as AiBudgetUsage;
    },
  });

  return (
    <section>
      <PageHeader
        title="AI moderation"
        subtitle="Daily OpenAI budget for moderation and copilot"
      />
      {isLoading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : isError ? (
        <div className="glass-panel flex flex-col items-center rounded-xl px-6 py-12 text-center">
          <p className="text-error">Failed to load AI budget.</p>
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Daily budget" value={data?.budget ?? 0} icon="analytics" />
            <StatCard label="Used today" value={data?.used ?? 0} icon="trending_up" />
            <StatCard
              label="Remaining"
              value={formatRemaining(data?.remaining ?? 0)}
              icon="timelapse"
            />
          </div>
          <p className="mb-6 text-sm text-on-surface-variant">
            Caps OpenAI moderation/copilot LLM calls per UTC day. Regex moderation still runs when
            budget is exhausted.
          </p>
          <h2 className="mb-3 text-sm font-semibold text-on-surface">Moderation queue</h2>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Waiting" value={data?.queue?.waiting ?? 0} icon="hourglass_empty" />
            <StatCard label="Active" value={data?.queue?.active ?? 0} icon="play_circle" />
            <StatCard label="Failed" value={data?.queue?.failed ?? 0} icon="error" />
            <StatCard label="Delayed" value={data?.queue?.delayed ?? 0} icon="schedule" />
          </div>
          <p className="text-sm text-on-surface-variant">
            BullMQ community moderation jobs. Failed jobs may need worker attention.
          </p>
        </>
      )}
    </section>
  );
}
