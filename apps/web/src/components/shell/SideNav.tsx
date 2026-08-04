'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@forge/design-system';
import { useAuth } from '@/lib/auth';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  guestHref?: string;
};

const PRIMARY: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/shorts', label: 'Shorts', icon: 'smart_display' },
  { href: '/trending', label: 'Trending', icon: 'local_fire_department' },
  {
    href: '/subscriptions',
    label: 'Subscriptions',
    icon: 'subscriptions',
    guestHref: '/login?next=/subscriptions',
  },
];

const YOU: NavItem[] = [
  {
    href: '/library',
    label: 'You',
    icon: 'person',
    guestHref: '/login?next=/library',
  },
  {
    href: '/history',
    label: 'History',
    icon: 'history',
    guestHref: '/login?next=/history',
  },
  {
    href: '/playlists/me/watch-later',
    label: 'Watch later',
    icon: 'watch_later',
    guestHref: '/login?next=/playlists/me/watch-later',
  },
  {
    href: '/playlists/me/liked',
    label: 'Liked videos',
    icon: 'thumb_up',
    guestHref: '/login?next=/playlists/me/liked',
  },
];

function NavLink({
  item,
  pathname,
  isGuest,
}: {
  item: NavItem;
  pathname: string;
  isGuest: boolean;
}) {
  const href = item.guestHref && isGuest ? item.guestHref : item.href;
  const active =
    pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-4 px-6 py-2.5 transition-all ${
        active
          ? 'border-r-2 border-primary bg-surface-container-high font-semibold text-on-surface'
          : 'text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface'
      }`}
    >
      <Icon name={item.icon} filled={active} />
      <span className="font-label-caps">{item.label}</span>
    </Link>
  );
}

export function SideNav() {
  const pathname = usePathname();
  const { isGuest, isLoading, accessTier, canApplyForCreator } = useAuth();
  const showStudioExtras = !isLoading && !isGuest;
  const studioHref =
    accessTier === 'guest'
      ? '/login?next=/studio'
      : accessTier === 'viewer' || accessTier === 'creator_rejected'
        ? '/studio'
        : accessTier === 'creator_pending'
          ? '/waiting-approval'
          : '/studio';

  return (
    <nav
      aria-label="Primary"
      className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-64px)] w-64 flex-col gap-1 overflow-y-auto border-r border-outline-variant/10 bg-surface-container-low/40 py-4 backdrop-blur-[20px] md:flex"
    >
      <p className="font-label-caps mb-1 mt-2 px-6 text-on-surface-variant">Navigation</p>
      {PRIMARY.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} isGuest={isGuest} />
      ))}

      <p className="font-label-caps mb-1 mt-4 px-6 text-on-surface-variant">You</p>
      {YOU.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} isGuest={isGuest} />
      ))}

      <Link
        href={studioHref}
        aria-current={pathname.startsWith('/studio') ? 'page' : undefined}
        className={`mt-auto flex items-center gap-4 px-6 py-3 transition-all ${
          pathname.startsWith('/studio')
            ? 'border-r-2 border-primary bg-surface-container-high font-semibold text-on-surface'
            : 'text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface'
        }`}
      >
        <Icon name="auto_videocam" />
        <span className="font-label-caps">Studio</span>
        {showStudioExtras && canApplyForCreator ? (
          <span className="text-[10px] text-tertiary">Apply</span>
        ) : null}
      </Link>
    </nav>
  );
}
