'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertStrip, Icon, PageHeader, buttonClassName, type AlertStripItem, type StatusTone } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchStudioLibrary } from '@/lib/creator-studio';
import { useStudioAccess } from '@/hooks/useStudioAccess';
import { formatCentsUsd, formatCount } from '@/lib/utils';

interface CreatorAttention {
  counts: {
    commentsNeedingReply: number;
    pendingModeration: number;
    failedPayments: number;
    processingFailures?: number;
    scheduledUpcoming?: number;
  };
  items: Array<{ id: string; kind: string; label: string; detail: string; href: string; tone: StatusTone }>;
}

/** Adapts next/link to AlertStrip's plain `{ href, className, children }` link contract. */
function StudioAttentionLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

const QUICK_ACTIONS = [
  { href: '/upload', label: 'Upload video', icon: 'upload', desc: 'Publish a new video' },
  { href: '/studio/live', label: 'Go live', icon: 'sensors', desc: 'Start or schedule a stream' },
  { href: '/studio/community', label: 'Community', icon: 'campaign', desc: 'Post to your channel Community tab' },
  { href: '/studio/comments', label: 'Comments', icon: 'forum', desc: 'Reply to viewer comments' },
  { href: '/studio/analytics', label: 'Analytics', icon: 'analytics', desc: 'Views, watch time, and growth' },
] as const;

const OPERATING_PILLARS = [
  {
    title: 'Content',
    href: '/studio/videos',
    icon: 'video_library',
    summary: 'Manage uploads, drafts, publishing, and processing issues.',
  },
  {
    title: 'Live',
    href: '/studio/live',
    icon: 'sensors',
    summary: 'Start streams, schedule events, and run your host control room.',
  },
  {
    title: 'Community',
    href: '/studio/community',
    icon: 'campaign',
    summary: 'Share updates on your public channel Community tab.',
  },
  {
    title: 'Engagement',
    href: '/studio/comments',
    icon: 'forum',
    summary: 'Reply to comments and keep conversations healthy.',
  },
  {
    title: 'Analytics',
    href: '/studio/analytics',
    icon: 'trending_up',
    summary: 'Track performance, subscribers, and retention.',
  },
] as const;

export default function StudioPage() {
  const { isCreator, user } = useAuth();
  const { isCollaborator, moderated, primaryRole } = useStudioAccess();

  const { data: attention, isLoading: attentionLoading } = useQuery({
    queryKey: ['studio-attention'],
    enabled: isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: CreatorAttention }>('/creators/me/attention');
      return data.data;
    },
  });

  const { data: libraryPreview } = useQuery({
    queryKey: ['studio-library-preview'],
    enabled: isCreator,
    queryFn: () => fetchStudioLibrary({ page: 1, limit: 1 }),
  });

  const { data: subscriberStats } = useQuery({
    queryKey: ['studio-dashboard-subscribers', user?.id],
    enabled: isCreator && !!user?.id,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { active: number; trial: number; mrrCents: number; canceled: number };
      }>('/creators/me/subscribers/analytics');
      return data.data;
    },
  });

  const { data: topVideos = [] } = useQuery({
    queryKey: ['studio-dashboard-top-content', user?.id],
    enabled: isCreator && !!user?.id,
    queryFn: async () => {
      const page = await fetchStudioLibrary({
        status: 'ready',
        sort: 'views',
        limit: 5,
        page: 1,
      });
      return page.items;
    },
  });

  const attentionItems: AlertStripItem[] | undefined = attention?.items.map((item) => ({
    id: item.id,
    label: item.label,
    detail: item.detail,
    href: item.href,
    tone: item.tone,
  }));
  const hasAttentionItems = (attentionItems?.length ?? 0) > 0;

  const creatorName = user?.displayName?.trim() || user?.username?.trim() || 'Creator';
  const totalAttention =
    (attention?.counts.commentsNeedingReply ?? 0) +
    (attention?.counts.pendingModeration ?? 0) +
    (attention?.counts.failedPayments ?? 0) +
    (attention?.counts.processingFailures ?? 0) +
    (attention?.counts.scheduledUpcoming ?? 0);
  const isFirstTimeCreator =
    libraryPreview?.pagination.total === 0 && !attentionLoading && !hasAttentionItems;
  const mrrDisplay = formatCentsUsd(subscriberStats?.mrrCents ?? 0);
  const readyVideoCount = topVideos.length;

  if (isCollaborator && !isCreator) {
    return (
      <main className="space-y-6">
        <PageHeader
          title={`Welcome, ${creatorName}`}
          subtitle={`Collaborator Studio · ${primaryRole ?? 'team'} access`}
        />
        <section className="glass-panel space-y-4 rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Your assigned communities</h2>
          <ul className="space-y-3">
            {moderated.map((row) => (
              <li key={`${row.communityId}-${row.role}`}>
                <Link
                  href={`/studio/moderation/${row.communityId}`}
                  className="flex items-center justify-between rounded-xl border border-outline-variant/30 px-4 py-3 hover:border-primary/40"
                >
                  <span>
                    <span className="font-medium">{row.community?.name ?? 'Community'}</span>
                    <span className="mt-1 block text-sm capitalize text-on-surface-variant">
                      {row.role}
                      {row.community?.creator?.displayName
                        ? ` · for ${row.community.creator.displayName}`
                        : ''}
                    </span>
                  </span>
                  <Icon name="chevron_right" className="text-outline" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/studio/moderation" className={buttonClassName('primary')}>
              Open moderation inbox
            </Link>
            <Link href="/messages" className="text-sm text-primary hover:underline self-center">
              Direct messages
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${creatorName}`}
        subtitle="Run your channel, publish faster, and keep up with what needs attention."
      />

      {isFirstTimeCreator ? (
        <section className="glass-panel rounded-2xl p-6">
          <p className="font-label-caps text-xs text-outline">Welcome</p>
          <h2 className="mt-2 text-xl font-semibold">Set up your creator channel</h2>
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
            Your Studio is ready. Upload your first video and grow your channel when you are ready to publish.
          </p>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            <li className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
              <p className="text-sm font-medium">1. Upload a video</p>
              <p className="mt-2 text-sm text-on-surface-variant">
                Start with a clear video your audience will want to watch and share.
              </p>
              <Link href="/upload" className="mt-3 inline-flex text-sm text-primary hover:underline">
                Open upload flow
              </Link>
            </li>
            <li className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
              <p className="text-sm font-medium">2. Shape your channel</p>
              <p className="mt-2 text-sm text-on-surface-variant">Customize your channel name, about, and links.</p>
              <Link href="/studio/branding" className="mt-3 inline-flex text-sm text-primary hover:underline">
                Customize channel
              </Link>
            </li>
            <li className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
              <p className="text-sm font-medium">3. Plan your launch</p>
              <p className="mt-2 text-sm text-on-surface-variant">Go live or publish when your first video is ready.</p>
              <Link href="/studio/live" className="mt-3 inline-flex text-sm text-primary hover:underline">
                Go live setup
              </Link>
            </li>
          </ol>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <div className="glass-panel rounded-2xl p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-label-caps text-xs text-outline">Channel dashboard</p>
              <h2 className="mt-1 text-xl font-semibold">Daily creator overview</h2>
            </div>
            <span className="rounded-full border border-outline-variant/40 px-3 py-1 text-xs text-on-surface-variant">
              Last refreshed automatically
            </span>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
              <p className="text-sm text-on-surface-variant">Active members</p>
              <p className="mt-2 text-2xl font-semibold">{formatCount(subscriberStats?.active ?? 0)}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
              <p className="text-sm text-on-surface-variant">MRR</p>
              <p className="mt-2 text-2xl font-semibold">{mrrDisplay}</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
              <p className="text-sm text-on-surface-variant">Library</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatCount(libraryPreview?.pagination.total ?? readyVideoCount)}
              </p>
            </div>
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
              <p className="text-sm text-on-surface-variant">Open attention</p>
              <p className="mt-2 text-2xl font-semibold">{formatCount(totalAttention)}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {OPERATING_PILLARS.map((pillar) => (
              <Link
                key={pillar.title}
                href={pillar.href}
                className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 transition-colors hover:border-primary/30"
              >
                <div className="mb-3 flex items-center justify-between">
                  <Icon name={pillar.icon} className="text-2xl text-primary" />
                  <Icon name="north_east" className="text-outline" />
                </div>
                <h3 className="font-semibold">{pillar.title}</h3>
                <p className="mt-2 text-sm text-on-surface-variant">{pillar.summary}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <p className="font-label-caps text-xs text-outline">Quick actions</p>
          <div className="mt-4 space-y-3">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-start gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low px-4 py-4 transition-colors hover:border-primary/30"
              >
                <span className="rounded-full bg-primary/10 p-2 text-primary">
                  <Icon name={action.icon} />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{action.label}</span>
                  <span className="block text-sm text-on-surface-variant">{action.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {attentionLoading ? null : hasAttentionItems ? (
        <section className="glass-panel rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-label-caps text-xs text-outline">Attention</p>
              <h2 className="text-lg font-semibold">What needs action now</h2>
            </div>
            <Link href="/studio/attention" className="text-sm text-primary hover:underline">
              {totalAttention > 0 ? `${totalAttention} items open` : 'Open queue'}
            </Link>
          </div>
          <AlertStrip items={attentionItems!} linkComponent={StudioAttentionLink} />
        </section>
      ) : (
        <section className="glass-panel rounded-2xl p-6">
          <p className="font-label-caps text-xs text-outline">Attention</p>
          <h2 className="mt-2 text-lg font-semibold">Your queue is clear</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            No urgent creator actions right now. Publish new content, start a live session, or review analytics trends.
          </p>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
        <div className="glass-panel rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-label-caps text-xs text-outline">Top content</p>
              <h2 className="text-lg font-semibold">Best performing videos</h2>
            </div>
            <Link href="/studio/videos" className="text-sm text-primary hover:underline">
              Open library
            </Link>
          </div>
          {topVideos.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              Ready videos will appear here once you publish. Upload your next video to start.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-outline">
                  <tr>
                    <th className="pb-3 font-medium">Title</th>
                    <th className="pb-3 font-medium">Views</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {topVideos.map((video) => (
                    <tr key={video.id} className="border-t border-outline-variant/20">
                      <td className="py-3">
                        <Link href={`/studio/videos/${video.id}`} className="font-medium hover:text-primary">
                          {video.title}
                        </Link>
                      </td>
                      <td className="py-3 text-on-surface-variant">{formatCount(video.viewCount ?? 0)}</td>
                      <td className="py-3 capitalize text-on-surface-variant">{video.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <p className="font-label-caps text-xs text-outline">Suggested journey</p>
          <ol className="mt-4 space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                1
              </span>
              <span className="text-on-surface-variant">
                Upload your next video or continue an in-progress draft from{' '}
                <Link href="/studio/videos" className="text-primary hover:underline">
                  Videos
                </Link>
                .
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                2
              </span>
              <span className="text-on-surface-variant">
                Check{' '}
                <Link href="/studio/attention" className="text-primary hover:underline">
                  Attention
                </Link>{' '}
                for replies, moderation, payments, and failed processing.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                3
              </span>
              <span className="text-on-surface-variant">
                Open{' '}
                <Link href="/studio/analytics" className="text-primary hover:underline">
                  Analytics
                </Link>{' '}
                to review growth and plan what to publish next.
              </span>
            </li>
          </ol>
        </div>
      </section>
    </main>
  );
}
