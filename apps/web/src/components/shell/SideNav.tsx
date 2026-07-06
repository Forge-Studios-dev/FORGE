'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@forge/design-system';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/explore', label: 'Explore', icon: 'explore' },
  { href: '/discover/communities', label: 'Communities', icon: 'groups' },
  { href: '/live', label: 'Live', icon: 'sensors' },
  { href: '/library', label: 'Library', icon: 'video_library', guestHref: '/login?next=/library' },
] as const;

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
      className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-64px)] w-64 flex-col gap-2 border-r border-outline-variant/10 bg-surface-container-low/40 py-6 backdrop-blur-[20px] md:flex"
    >
      <p className="font-label-caps mb-4 mt-2 px-6 text-outline">Navigation</p>
      {NAV.map((item) => {
        const href =
          'guestHref' in item && isGuest ? item.guestHref : item.href;
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`group flex items-center gap-4 px-6 py-3 transition-all ${
              active
                ? 'border-r-2 border-primary bg-primary/5 text-primary'
                : 'text-outline hover:bg-surface-container-high/60 hover:text-on-surface'
            }`}
          >
            <Icon name={item.icon} filled={active} />
            <span className="font-label-caps">{item.label}</span>
          </Link>
        );
      })}
      <Link
        href={studioHref}
        aria-current={pathname.startsWith('/studio') ? 'page' : undefined}
        className={`mt-auto flex items-center gap-4 px-6 py-3 transition-all ${
          pathname.startsWith('/studio')
            ? 'border-r-2 border-primary bg-primary/5 text-primary'
            : 'text-outline hover:bg-surface-container-high/60 hover:text-on-surface'
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
