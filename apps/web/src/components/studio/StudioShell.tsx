'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@forge/design-system';
import { StudioCommandBar } from '@/components/studio/StudioCommandBar';
import { StudioCollaboratorDenied } from '@/components/studio/StudioCollaboratorDenied';
import { useStudioAccess } from '@/hooks/useStudioAccess';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: string;
};

const CREATOR_NAV: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Home',
    items: [
      { href: '/studio', label: 'Dashboard', icon: 'space_dashboard' },
      { href: '/studio/attention', label: 'Attention', icon: 'notifications_active', badge: 'Now' },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/studio/videos', label: 'Videos', icon: 'video_library' },
      { href: '/studio/live', label: 'Live', icon: 'sensors' },
      { href: '/studio/courses', label: 'Courses', icon: 'school' },
      { href: '/studio/podcasts', label: 'Podcasts', icon: 'podcasts' },
      { href: '/studio/playlists', label: 'Playlists', icon: 'playlist_play' },
      { href: '/studio/comments', label: 'Comments', icon: 'forum' },
    ],
  },
  {
    label: 'Community',
    items: [
      { href: '/studio/communities', label: 'Communities', icon: 'hub' },
      { href: '/studio/moderation', label: 'Moderation', icon: 'shield' },
      { href: '/messages', label: 'Messages', icon: 'chat' },
      { href: '/studio/channel-points', label: 'Channel points', icon: 'stars' },
      { href: '/studio/mentorship', label: 'Mentorship', icon: 'diversity_3' },
      { href: '/studio/brands', label: 'Brands', icon: 'storefront' },
    ],
  },
  {
    label: 'Grow',
    items: [
      { href: '/studio/analytics', label: 'Analytics', icon: 'analytics' },
      { href: '/studio/tiers', label: 'Memberships', icon: 'workspace_premium' },
      { href: '/studio/subscribers', label: 'Subscribers', icon: 'groups' },
      { href: '/studio/bundles', label: 'Bundles', icon: 'inventory_2' },
      { href: '/studio/resources', label: 'Resources', icon: 'folder_open' },
      { href: '/studio/referrals', label: 'Referrals', icon: 'share' },
      { href: '/studio/ai-copilot', label: 'AI Copilot', icon: 'auto_awesome' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/studio/settings', label: 'Settings', icon: 'settings' },
      { href: '/studio/upload-reliability', label: 'Upload reliability', icon: 'cloud_sync' },
      { href: '/studio/system-states', label: 'System states', icon: 'health_and_safety' },
    ],
  },
];

const COLLABORATOR_NAV: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Home',
    items: [{ href: '/studio', label: 'Dashboard', icon: 'space_dashboard' }],
  },
  {
    label: 'Community',
    items: [
      { href: '/studio/moderation', label: 'Moderation', icon: 'shield' },
      { href: '/messages', label: 'Messages', icon: 'chat' },
    ],
  },
  {
    label: 'Settings',
    items: [{ href: '/studio/settings', label: 'Settings', icon: 'settings' }],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/studio' ? pathname === href : pathname.startsWith(href);
}

function isCollaboratorAllowedPath(pathname: string): boolean {
  if (pathname === '/studio') return true;
  if (pathname.startsWith('/studio/moderation')) return true;
  if (pathname.startsWith('/studio/settings')) return true;
  if (pathname === '/messages' || pathname.startsWith('/messages/')) return true;
  return false;
}

export function StudioShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode, isCollaborator, primaryRole } = useStudioAccess();
  const navGroups = mode === 'collaborator' ? COLLABORATOR_NAV : CREATOR_NAV;
  const showDenied = isCollaborator && !isCollaboratorAllowedPath(pathname);

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 px-5 py-6 md:px-8 xl:px-10">
      <a
        href="#studio-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-primary"
      >
        Skip to studio content
      </a>
      <aside className="hidden w-72 shrink-0 lg:block" aria-label="Studio sidebar">
        <div className="sticky top-24 space-y-4">
          <div className="glass-panel rounded-2xl p-4">
            <p className="font-label-caps mb-2 text-xs text-outline">
              {isCollaborator ? 'Team Studio' : 'Creator Studio'}
            </p>
            <h2 className="font-display-forge text-xl font-semibold">
              {isCollaborator ? 'Help run the community' : 'Operate your channel'}
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              {isCollaborator
                ? `Signed in as ${primaryRole ?? 'collaborator'}. You can moderate assigned communities and messages.`
                : 'Publish, teach live, grow memberships, and run your community from one place.'}
            </p>
            {isCollaborator ? (
              <Link
                href="/studio/moderation"
                className="primary-button mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 font-semibold text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon name="shield" />
                Open moderation
              </Link>
            ) : (
              <Link
                href="/upload"
                className="primary-button mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 font-semibold text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon name="add" />
                Create
              </Link>
            )}
          </div>

          <nav className="glass-panel rounded-2xl p-3" aria-label="Studio navigation">
            {navGroups.map((group) => (
              <section key={group.label} className="mb-3 last:mb-0">
                <p className="font-label-caps px-3 py-2 text-xs text-outline">{group.label}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                          active
                            ? 'bg-primary/12 text-on-surface ring-1 ring-primary/30'
                            : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon name={item.icon} className={active ? 'text-primary' : 'text-outline'} />
                          <span className="font-medium">{item.label}</span>
                        </span>
                        {item.badge ? (
                          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] text-outline">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <StudioCommandBar collaboratorMode={isCollaborator} />

        {isCollaborator ? (
          <div className="mb-4 rounded-2xl border border-primary/25 bg-primary/8 px-4 py-3 text-sm text-on-surface-variant">
            Collaborator access — moderation tools only. Channel publishing and revenue tools stay with the creator.
          </div>
        ) : null}

        <div className="mb-5 overflow-x-auto lg:hidden" aria-label="Studio mobile navigation">
          <div className="flex min-w-max gap-2">
            {navGroups.flatMap((group) => group.items).map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    active
                      ? 'border-primary/40 bg-primary/10 text-on-surface'
                      : 'border-outline-variant/30 text-on-surface-variant'
                  }`}
                >
                  <Icon name={item.icon} className="text-base" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div id="studio-main" className="motion-safe:transition-opacity">
          {showDenied ? <StudioCollaboratorDenied /> : children}
        </div>
      </div>
    </div>
  );
}
