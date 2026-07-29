'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, Icon, ListSkeleton, PageHeader, StatusPill, type StatusTone } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type CreatorAttention = {
  counts: {
    commentsNeedingReply: number;
    pendingModeration: number;
    failedPayments: number;
    processingFailures?: number;
  };
  items: Array<{
    id: string;
    kind: string;
    label: string;
    detail: string;
    href: string;
    tone: StatusTone;
  }>;
};

export default function StudioAttentionPage() {
  const { isCreator } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['studio-attention-full'],
    enabled: isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: CreatorAttention }>('/creators/me/attention');
      return data.data;
    },
  });

  if (!isCreator) {
    return (
      <main className="space-y-6">
        <PageHeader title="Attention" subtitle="Creator access required." />
        <Link href="/studio/moderation" className="text-sm text-primary hover:underline">
          Open moderation center
        </Link>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Attention"
        subtitle="A single queue for replies, moderation, payments, and processing issues."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Comments needing reply</p>
          <p className="mt-2 text-3xl font-semibold">{data?.counts.commentsNeedingReply ?? 0}</p>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Pending moderation</p>
          <p className="mt-2 text-3xl font-semibold">{data?.counts.pendingModeration ?? 0}</p>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Failed payments</p>
          <p className="mt-2 text-3xl font-semibold">{data?.counts.failedPayments ?? 0}</p>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Processing failures</p>
          <p className="mt-2 text-3xl font-semibold">{data?.counts.processingFailures ?? 0}</p>
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-label-caps text-xs text-outline">Inbox</p>
            <h2 className="text-lg font-semibold">What needs action now</h2>
          </div>
          <Link href="/studio/comments" className="text-sm text-primary hover:underline">
            Open comments workspace
          </Link>
        </div>

        {isLoading ? <ListSkeleton rows={5} /> : null}
        {isError ? <p className="text-sm text-error">Failed to load your attention queue.</p> : null}

        {!isLoading && !isError && !data?.items.length ? (
          <EmptyState
            icon="notifications_active"
            title="Nothing urgent right now"
            description="Your creator queue is clear. Publish, go live, or check analytics while things are quiet."
            action={{ label: 'Upload a lesson', href: '/upload' }}
          />
        ) : null}

        <div className="space-y-3">
          {data?.items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex flex-col gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 transition-colors hover:border-primary/30 md:flex-row md:items-start md:justify-between"
            >
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <StatusPill tone={item.tone} label={item.kind.replace(/_/g, ' ')} />
                </div>
                <h3 className="font-medium text-on-surface">{item.label}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{item.detail}</p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm text-primary">
                Review
                <Icon name="east" className="text-base" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
