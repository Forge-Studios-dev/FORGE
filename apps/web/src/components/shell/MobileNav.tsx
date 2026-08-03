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

export function MobileNav() {
  const pathname = usePathname();
  const { isGuest, isLoading, accessTier } = useAuth();

  const items: NavItem[] = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/shorts', label: 'Shorts', icon: 'smart_display' },
    {
      href: '/subscriptions',
      label: 'Subs',
      icon: 'subscriptions',
      guestHref: '/login?next=/subscriptions',
    },
    {
      href: '/library',
      label: 'You',
      icon: 'person',
      guestHref: '/login?next=/library',
    },
  ];

  // Match desktop SideNav: Studio entry for signed-in users (gate handles apply/pending).
  if (!isLoading && !isGuest) {
    const studioHref =
      accessTier === 'creator_pending' ? '/waiting-approval' : '/studio';
    items.push({ href: studioHref, label: 'Studio', icon: 'dashboard' });
  }

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-outline-variant/20 bg-surface-container-low/90 backdrop-blur-[30px] md:hidden"
    >
      {items.map((item) => {
        const href = item.guestHref && isGuest ? item.guestHref : item.href;
        const active =
          pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`forge-nav-item flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[10px] ${
              active ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            <Icon name={item.icon} filled={active} className="text-xl" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
