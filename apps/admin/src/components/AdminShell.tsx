'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '@forge/design-system';
import { adminLogout, api } from '@/lib/api';
import { FULL_ADMIN_ONLY_HREFS, useAdminProfile } from '@/lib/admin-profile';
import { useTheme } from '@/components/theme/ThemeProvider';
import { env } from '@/env';

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' }],
  },
  {
    label: 'Moderation',
    items: [
      { href: '/creator-approvals', label: 'Approvals', icon: 'verified' },
      { href: '/content', label: 'Content', icon: 'video_library' },
      { href: '/comments', label: 'Held comments', icon: 'forum' },
      { href: '/reports', label: 'Reports', icon: 'flag' },
      { href: '/ai', label: 'AI budget', icon: 'psychology' },
      { href: '/users', label: 'Users', icon: 'group' },
      { href: '/copyright', label: 'Copyright & Strikes', icon: 'gavel' },
      { href: '/audit', label: 'Audit log', icon: 'history' },
    ],
  },
  {
    label: 'Community',
    items: [
      { href: '/community', label: 'Community', icon: 'forum' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/categories', label: 'Categories', icon: 'category' },
      { href: '/live', label: 'Live', icon: 'sensors' },
      { href: '/fraud', label: 'Fraud', icon: 'security' },
      { href: '/billing', label: 'Billing', icon: 'receipt_long' },
      { href: '/analytics', label: 'Analytics', icon: 'analytics' },
      { href: '/search', label: 'Search', icon: 'search' },
      { href: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  pathname,
  onNavigate,
  fullAdmin,
}: {
  pathname: string;
  onNavigate?: () => void;
  fullAdmin: boolean;
}) {
  return (
    <>
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter(
          (item) => fullAdmin || !FULL_ADMIN_ONLY_HREFS.has(item.href),
        );
        if (items.length === 0) return null;
        return (
        <section key={group.label} className="mb-3 last:mb-0">
          <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-outline">
            {group.label}
          </p>
          {items.map((item) => {
            const active = isActive(pathname, item.href);
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
        </section>
        );
      })}
    </>
  );
}

function SidebarFooter({ onLogout, onNavigate }: { onLogout: () => void; onNavigate?: () => void }) {
  return (
    <div className="border-t border-outline-variant/20 p-4">
      <Link
        href={env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'}
        className="mb-2 flex items-center gap-2 text-xs text-outline hover:text-on-surface"
        onClick={onNavigate}
      >
        <Icon name="open_in_new" className="text-sm" />
        View public site
      </Link>
      <button type="button" onClick={onLogout} className="text-xs text-error hover:underline">
        Sign out
      </button>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { data: adminProfile } = useAdminProfile();
  const fullAdmin = adminProfile?.adminTier !== 'moderator';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (pathname === '/login' || pathname === '/unauthorized') return;
    let cancelled = false;
    const load = () => {
      void api
        .get<{ data: { enabled: boolean } }>('/auth/mfa/status')
        .then(({ data }) => {
          if (!cancelled) setMfaEnabled(!!data.data.enabled);
        })
        .catch(() => {
          if (!cancelled) setMfaEnabled(null);
        });
    };
    load();
    const onMfa = (ev: Event) => {
      const detail = (ev as CustomEvent<{ enabled?: boolean }>).detail;
      if (typeof detail?.enabled === 'boolean') setMfaEnabled(detail.enabled);
      else load();
    };
    window.addEventListener('forge-admin-mfa', onMfa);
    return () => {
      cancelled = true;
      window.removeEventListener('forge-admin-mfa', onMfa);
    };
  }, [pathname]);

  if (pathname === '/login' || pathname === '/unauthorized') {
    return <>{children}</>;
  }

  const logout = () => {
    void adminLogout().then(() => router.push('/login'));
  };

  const showMfaBanner = mfaEnabled === false && pathname !== '/settings';

  return (
    <div className="flex min-h-screen bg-surface-container-lowest">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-outline-variant/20 bg-surface-container-low md:flex">
        <div className="border-b border-outline-variant/20 p-6">
          <Link href="/dashboard" className="font-display-forge text-xl font-bold text-primary">
            FORGE Admin
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
          <NavLinks pathname={pathname} fullAdmin={fullAdmin} />
        </nav>
        <SidebarFooter onLogout={logout} />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-outline-variant/20 bg-surface-container-low px-4 py-3 md:px-6">
          <Link href="/dashboard" className="font-display-forge text-lg font-bold text-primary md:hidden">
            FORGE Admin
          </Link>
          <p className="hidden text-sm text-on-surface-variant md:block">Platform administration</p>
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/30 px-3 py-1.5 text-sm text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
            >
              <Icon name="search" className="text-base" />
              <span className="hidden sm:inline">Search</span>
            </Link>
            <button
              type="button"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggleTheme}
              className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            >
              <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} className="text-xl" />
            </button>
            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface md:hidden"
            >
              <Icon name={mobileOpen ? 'close' : 'menu'} className="text-2xl" />
            </button>
          </div>
        </header>

        {showMfaBanner ? (
          <div
            className="border-b border-error/30 bg-error-container/20 px-4 py-3 text-sm text-on-surface md:px-6"
            role="status"
          >
            Two-factor authentication is required for admin API actions.{' '}
            <Link href="/settings" className="font-semibold text-primary hover:underline">
              Enable MFA in Settings
            </Link>
          </div>
        ) : null}

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
                <NavLinks pathname={pathname} fullAdmin={fullAdmin} onNavigate={() => setMobileOpen(false)} />
              </nav>
              <SidebarFooter onLogout={logout} onNavigate={() => setMobileOpen(false)} />
            </aside>
          </>
        )}

        <main className="forge-page-enter flex-1 overflow-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
