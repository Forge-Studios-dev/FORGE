'use client';

import { usePathname } from 'next/navigation';
import { TopBar } from './TopBar';
import { SideNav } from './SideNav';
import { MobileNav } from './MobileNav';
import { SiteFooter } from './SiteFooter';

const MINIMAL_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/waiting-approval',
  '/approval-rejected',
  '/offline',
  '/maintenance',
  '/session-expired',
];

/** Watch uses full-width canvas — no desktop side nav (Stitch blueprint) */
function isWatchRoute(pathname: string) {
  return pathname.startsWith('/watch/');
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const minimal = MINIMAL_PREFIXES.some((p) => pathname.startsWith(p));
  const watchLayout = isWatchRoute(pathname);

  if (minimal) {
    return <>{children}</>;
  }

  return (
    <>
      <TopBar />
      {!watchLayout && <SideNav />}
      <div
        className={`forge-page-enter flex min-h-screen flex-col pb-24 pt-16 md:pb-12 ${
          watchLayout ? '' : 'md:pl-64'
        }`}
      >
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
      <MobileNav />
    </>
  );
}
