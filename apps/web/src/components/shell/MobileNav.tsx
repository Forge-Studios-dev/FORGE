'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@forge/design-system';
import { useAuth } from '@/lib/auth';

const BASE_NAV = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/explore', label: 'Explore', icon: 'explore' },
  { href: '/live', label: 'Live', icon: 'sensors' },
  { href: '/library', label: 'Library', icon: 'video_library', guestHref: '/login?next=/library' },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const { isGuest, isCreator, isLoading, isPlatformAdmin } = useAuth();

  const lastItem =
    isLoading
      ? { href: '/profile', label: 'Profile', icon: 'person' }
      : isPlatformAdmin
        ? {
            href: process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3002',
            label: 'Admin',
            icon: 'admin_panel_settings',
          }
      : isCreator
        ? { href: '/studio', label: 'Studio', icon: 'dashboard' }
        : { href: isGuest ? '/login' : '/profile', label: 'Profile', icon: 'person' };

  const nav = [...BASE_NAV, lastItem];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-outline-variant/20 bg-surface-container-low/90 backdrop-blur-[30px] md:hidden">
      {nav.map((item) => {
        const href =
          'guestHref' in item && isGuest ? item.guestHref : item.href;
        const active =
          pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        const external = href.startsWith('http');
        const className = `forge-nav-item flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[10px] ${
          active ? 'text-primary' : 'text-on-surface-variant'
        }`;
        if (external) {
          return (
            <a key={item.href} href={href} className={className}>
              <Icon name={item.icon} filled={active} className="text-xl" />
              {item.label}
            </a>
          );
        }
        return (
          <Link
            key={item.href}
            href={href}
            className={className}
          >
            <Icon name={item.icon} filled={active} className="text-xl" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
