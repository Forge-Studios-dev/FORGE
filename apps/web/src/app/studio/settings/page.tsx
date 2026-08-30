'use client';

import Link from 'next/link';
import { Icon, PageHeader, StatusPill, buttonClassName } from '@forge/design-system';
import { useAuth } from '@/lib/auth';
import { useStudioAccess } from '@/hooks/useStudioAccess';

const CREATOR_LINKS = [
  {
    href: '/studio/branding',
    title: 'Customize channel',
    desc: 'Channel name, handle, about text, website, and links.',
    icon: 'palette',
  },
  {
    href: '/profile/settings',
    title: 'Profile & account',
    desc: 'Password, email verification, and privacy preferences.',
    icon: 'manage_accounts',
  },
  {
    href: '/studio/earnings',
    title: 'Earnings',
    desc: 'Unified membership MRR, Super Thanks, and Super Chat summary.',
    icon: 'payments',
  },
  {
    href: '/studio/tiers',
    title: 'Memberships & Stripe',
    desc: 'Configure tiers, entitlements, and Connect payout onboarding.',
    icon: 'workspace_premium',
  },
  {
    href: '/studio/super-thanks',
    title: 'Super Thanks',
    desc: 'Review Super Thanks from viewers and export a CSV.',
    icon: 'volunteer_activism',
  },
  {
    href: '/studio/community',
    title: 'Community posts',
    desc: 'Publish updates to your channel Community tab.',
    icon: 'campaign',
  },
  {
    href: '/studio/attention',
    title: 'Attention queue',
    desc: 'Comments needing reply, moderation, and processing failures.',
    icon: 'priority_high',
  },
  {
    href: '/notifications',
    title: 'Notifications',
    desc: 'Review creator alerts for comments, payments, and live events.',
    icon: 'notifications',
  },
  {
    href: '/messages',
    title: 'Direct messages',
    desc: 'Reply to member conversations and group DMs.',
    icon: 'chat',
  },
] as const;

const COLLABORATOR_LINKS = [
  {
    href: '/profile/settings',
    title: 'Profile & account',
    desc: 'Update your display name, username, and security settings.',
    icon: 'manage_accounts',
  },
  {
    href: '/notifications',
    title: 'Notifications',
    desc: 'Stay on top of moderation and community alerts.',
    icon: 'notifications',
  },
  {
    href: '/messages',
    title: 'Direct messages',
    desc: 'Reply to member conversations and group DMs.',
    icon: 'chat',
  },
  {
    href: '/studio/moderation',
    title: 'Moderation center',
    desc: 'Review reports across communities you help run.',
    icon: 'shield',
  },
] as const;

export default function StudioSettingsPage() {
  const { user, isCreator } = useAuth();
  const { isCollaborator, primaryRole } = useStudioAccess();
  const links = isCollaborator && !isCreator ? COLLABORATOR_LINKS : CREATOR_LINKS;
  const roleLabel = isCreator
    ? 'Creator'
    : isCollaborator
      ? (primaryRole ?? 'Collaborator')
      : 'Viewer';

  return (
    <main className="space-y-6">
      <PageHeader
        title="Studio settings"
        subtitle={
          isCollaborator && !isCreator
            ? 'Account controls for your collaborator Studio session.'
            : 'Channel preferences, team-adjacent tools, and account controls.'
        }
      />

      <section className="glass-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-label-caps text-xs text-outline">
              {isCollaborator && !isCreator ? 'Team member' : 'Channel'}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{user?.displayName ?? 'Creator'}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              @{user?.username ?? '—'} · {user?.email ?? '—'}
            </p>
          </div>
          <StatusPill
            tone={isCreator || isCollaborator ? 'success' : 'neutral'}
            label={roleLabel}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/profile/settings"
            className={buttonClassName('primary')}
          >
            Edit profile
          </Link>
          {user?.username ? (
            <Link href={`/${user.username}`} className="self-center text-sm text-primary hover:underline">
              View public profile
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="glass-panel flex items-start gap-4 rounded-2xl p-5 transition-colors hover:border-primary/30"
          >
            <span className="rounded-full bg-primary/10 p-2 text-primary">
              <Icon name={item.icon} />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-on-surface">{item.title}</span>
              <span className="mt-1 block text-sm text-on-surface-variant">{item.desc}</span>
            </span>
          </Link>
        ))}
      </section>

      {isCreator ? (
        <section className="glass-panel rounded-2xl p-6">
          <p className="font-label-caps text-xs text-outline">Team access</p>
          <h2 className="mt-1 text-lg font-semibold">Moderators & coaches</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Channel team access is managed from Moderation. Invite moderators with scoped
            permissions for comments and live chat.
          </p>
          <Link href="/studio/moderation" className="mt-4 inline-flex text-sm text-primary hover:underline">
            Open moderation center
          </Link>
        </section>
      ) : (
        <section className="glass-panel rounded-2xl p-6">
          <p className="font-label-caps text-xs text-outline">Team access</p>
          <h2 className="mt-1 text-lg font-semibold">Your collaborator role</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            You can moderate assigned communities and messages. Publishing, memberships, and payouts
            stay with the channel owner.
          </p>
          <Link href="/studio/moderation" className="mt-4 inline-flex text-sm text-primary hover:underline">
            Open moderation center
          </Link>
        </section>
      )}
    </main>
  );
}
