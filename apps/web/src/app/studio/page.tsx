'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertStrip, Icon, PageHeader, type AlertStripItem, type StatusTone } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type StudioLink = { href: string; label: string; icon: string; desc: string };

interface CreatorAttention {
  counts: { commentsNeedingReply: number; pendingModeration: number; failedPayments: number };
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

/**
 * Grouped by creator job-to-be-done (Content / Community / Grow / Settings) rather
 * than a flat alphabetical module list — a new creator's first Studio visit should
 * read as 4 jobs, not 15 peers. See docs/FORGE_PROJECT_MASTER.md §8 (design system)
 * and the product redesign blueprint for the rationale.
 */
const ZONES: { zone: string; items: StudioLink[] }[] = [
  {
    zone: 'Content',
    items: [
      { href: '/studio/videos', label: 'Videos', icon: 'video_library', desc: 'Manage uploads' },
      { href: '/studio/courses', label: 'Courses', icon: 'school', desc: 'Lessons & multi-course programs' },
      { href: '/studio/live', label: 'Go live', icon: 'sensors', desc: 'Start a live session' },
      { href: '/studio/comments', label: 'Comments', icon: 'forum', desc: 'Community feedback' },
    ],
  },
  {
    zone: 'Community',
    items: [
      { href: '/studio/communities', label: 'Communities', icon: 'hub', desc: 'Channels, categories & moderation' },
      { href: '/studio/moderation', label: 'Moderation', icon: 'shield', desc: 'Delegated community moderation' },
      { href: '/studio/brands', label: 'Brands', icon: 'storefront', desc: 'Brand identities' },
    ],
  },
  {
    zone: 'Grow',
    items: [
      { href: '/studio/analytics', label: 'Analytics', icon: 'analytics', desc: 'Performance insights' },
      { href: '/studio/tiers', label: 'Memberships', icon: 'workspace_premium', desc: 'Configure member tiers' },
      { href: '/studio/subscribers', label: 'Subscribers', icon: 'groups', desc: 'Manage members & export' },
      { href: '/studio/bundles', label: 'Bundles', icon: 'inventory_2', desc: 'Package tiers with multiple resources' },
    ],
  },
  {
    zone: 'Settings',
    items: [
      { href: '/studio/settings', label: 'Settings', icon: 'settings', desc: 'Channel preferences' },
    ],
  },
];

const DISCOVER_LINKS: StudioLink[] = [
  { href: '/discover/communities', label: 'Discover communities', icon: 'travel_explore', desc: 'Find public communities' },
  { href: '/discover/courses', label: 'Discover courses', icon: 'menu_book', desc: 'Find published creator courses' },
];

export default function StudioPage() {
  const { isCreator } = useAuth();

  const { data: attention } = useQuery({
    queryKey: ['studio-attention'],
    enabled: isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: CreatorAttention }>('/creators/me/attention');
      return data.data;
    },
  });

  const attentionItems: AlertStripItem[] | undefined = attention?.items.map((item) => ({
    id: item.id,
    label: item.label,
    detail: item.detail,
    href: item.href,
    tone: item.tone,
  }));

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader title="Creator Studio" subtitle="Upload, teach live, and grow your audience" />
      <div className="mb-8">
        <Link
          href="/upload"
          className="primary-button inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold text-on-primary"
        >
          <Icon name="upload" />
          Upload new lesson
        </Link>
      </div>

      {attentionItems ? (
        <div className="mb-8">
          <AlertStrip items={attentionItems} linkComponent={StudioAttentionLink} />
        </div>
      ) : null}

      {ZONES.map((group) => (
        <section key={group.zone} className="mb-8">
          <h2 className="font-label-caps mb-3 text-outline">{group.zone}</h2>
          <div className="forge-stagger grid gap-4 sm:grid-cols-2">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="forge-card-hover glass-panel flex items-start gap-4 rounded-xl p-5 transition-colors hover:border-primary/30"
              >
                <Icon name={item.icon} className="text-2xl text-primary" />
                <div>
                  <h3 className="font-semibold">{item.label}</h3>
                  <p className="text-sm text-on-surface-variant">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section>
        <h2 className="font-label-caps mb-3 text-outline">Discover</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {DISCOVER_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg border border-outline-variant/30 px-4 py-3 text-sm transition-colors hover:border-primary/30"
            >
              <Icon name={item.icon} className="text-lg text-outline" />
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-on-surface-variant">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
