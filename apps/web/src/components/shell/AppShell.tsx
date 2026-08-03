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
  '/embed',
];

/** Watch and Shorts — full-bleed canvas, no consumer chrome */
function isImmersiveRoute(pathname: string) {
  return pathname.startsWith('/watch/') || pathname === '/shorts' || pathname.startsWith('/shorts/');
}

/** Creator Studio — TopBar only (StudioShell owns the sidebar) */
function isStudioRoute(pathname: string) {
  return pathname === '/studio' || pathname.startsWith('/studio/');
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const minimal = MINIMAL_PREFIXES.some((p) => pathname.startsWith(p));
  const immersive = isImmersiveRoute(pathname);
  const studio = isStudioRoute(pathname);

  if (minimal) {
    return (
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
    );
  }

  if (immersive) {
    return (
      <div id="main-content" className="min-h-dvh" tabIndex={-1}>
        {children}
      </div>
    );
  }

  if (studio) {
    return (
      <>
        <TopBar />
        <div className="forge-page-enter flex min-h-screen flex-col pt-16">
          <div id="main-content" className="flex-1" tabIndex={-1}>
            {children}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <SideNav />
      <div className="forge-page-enter flex min-h-screen flex-col pb-24 pt-16 md:pb-12 md:pl-64">
        <div id="main-content" className="flex-1" tabIndex={-1}>
          {children}
        </div>
        <SiteFooter />
      </div>
      <MobileNav />
    </>
  );
}
