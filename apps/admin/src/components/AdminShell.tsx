'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@forge/design-system';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/creator-approvals', label: 'Approvals', icon: 'verified' },
  { href: '/content', label: 'Content', icon: 'video_library' },
  { href: '/reports', label: 'Reports', icon: 'flag' },
  { href: '/users', label: 'Users', icon: 'group' },
  { href: '/categories', label: 'Categories', icon: 'category' },
  { href: '/analytics', label: 'Analytics', icon: 'analytics' },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/login' || pathname === '/unauthorized') {
    return <>{children}</>;
  }

  const logout = () => {
    localStorage.removeItem('forge_admin_token');
    localStorage.removeItem('forge_admin_refresh_token');
    document.cookie = 'forge_admin_token=; path=/; max-age=0';
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen bg-surface-container-lowest">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-outline-variant/20 bg-surface-container-low md:flex">
        <div className="border-b border-outline-variant/20 p-6">
          <Link href="/dashboard" className="font-display-forge text-xl font-bold text-primary">
            FORGE Admin
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
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
      <main className="forge-page-enter flex-1 overflow-auto p-6 md:p-8">{children}</main>
    </div>
  );
}
