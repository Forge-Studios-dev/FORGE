'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@forge/design-system';
import { adminLogout } from '@/lib/api';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/creator-approvals', label: 'Approvals', icon: 'verified' },
  { href: '/content', label: 'Content', icon: 'video_library' },
  { href: '/reports', label: 'Reports', icon: 'flag' },
  { href: '/community', label: 'Community', icon: 'forum' },
  { href: '/users', label: 'Users', icon: 'group' },
  { href: '/categories', label: 'Categories', icon: 'category' },
  { href: '/live', label: 'Live', icon: 'sensors' },
  { href: '/analytics', label: 'Analytics', icon: 'analytics' },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm ${
              active
                ? 'bg-primary/10 text-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <Icon name={item.icon} filled={active} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname === '/login' || pathname === '/unauthorized') {
    return <>{children}</>;
  }

  const logout = () => {
    void adminLogout().then(() => router.push('/login'));
  };

  return (
    <div className="flex min-h-screen bg-surface-container-lowest">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-outline-variant/20 bg-surface-container-low md:flex">
        <div className="border-b border-outline-variant/20 p-6">
          <Link href="/dashboard" className="font-display-forge text-xl font-bold text-primary">
            FORGE Admin
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="border-t border-outline-variant/20 p-4">
          <Link
            href={process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'}
            className="mb-2 flex items-center gap-2 text-xs text-outline hover:text-on-surface"
          >
            <Icon name="open_in_new" className="text-sm" />
            View public site
          </Link>
          <button type="button" onClick={logout} className="text-xs text-error hover:underline">
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header + drawer */}
      <div className="flex min-h-screen flex-1 flex-col md:contents">
        <header className="flex items-center justify-between border-b border-outline-variant/20 bg-surface-container-low px-4 py-3 md:hidden">
          <Link href="/dashboard" className="font-display-forge text-lg font-bold text-primary">
            FORGE Admin
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Icon name={mobileOpen ? 'close' : 'menu'} className="text-2xl" />
          </button>
        </header>

        {mobileOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu overlay"
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-outline-variant/20 bg-surface-container-low md:hidden">
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4 pt-6">
                <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </nav>
              <div className="border-t border-outline-variant/20 p-4">
                <Link
                  href={process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'}
                  className="mb-2 flex items-center gap-2 text-xs text-outline hover:text-on-surface"
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon name="open_in_new" className="text-sm" />
                  View public site
                </Link>
                <button type="button" onClick={logout} className="text-xs text-error hover:underline">
                  Sign out
                </button>
              </div>
            </aside>
          </>
        )}

        <main className="forge-page-enter flex-1 overflow-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
