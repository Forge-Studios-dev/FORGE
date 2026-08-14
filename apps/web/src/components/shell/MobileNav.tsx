'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@forge/design-system';
import { useAuth } from '@/lib/auth';
import { PopoverMenu } from '@/components/shell/PopoverMenu';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  guestHref?: string;
};

/**
 * YouTube-style mobile primary nav: Home · Shorts · Create · Subs · You.
 * Studio lives under Account / Library — not a bottom-tab destination.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { isGuest, canUpload, canGoLive, canApplyForCreator } = useAuth();

  const items: NavItem[] = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/shorts', label: 'Shorts', icon: 'smart_display' },
  ];

  const you: NavItem = {
    href: '/library',
    label: 'You',
    icon: 'person',
    guestHref: '/login?next=/library',
  };

  const subs: NavItem = {
    href: '/subscriptions',
    label: 'Subs',
    icon: 'subscriptions',
    guestHref: '/login?next=/subscriptions',
  };

  const renderLink = (item: NavItem) => {
    const href = item.guestHref && isGuest ? item.guestHref : item.href;
    const active =
      pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
    return (
      <Link
        key={item.href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`forge-nav-item flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs ${
          active ? 'text-primary' : 'text-on-surface-variant'
        }`}
      >
        <Icon name={item.icon} filled={active} className="text-xl" />
        {item.label}
      </Link>
    );
  };

  const createGuestHref = '/login?next=/upload';
  const showCreateMenu = !isGuest && (canUpload || canGoLive || canApplyForCreator);

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-outline-variant/20 bg-surface-container-low/90 backdrop-blur-[30px] md:hidden"
    >
      {items.map(renderLink)}

      {isGuest ? (
        <Link
          href={createGuestHref}
          className="forge-nav-item flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs text-on-surface-variant"
          aria-label="Create"
        >
          <Icon name="add_circle" className="text-xl" />
          Create
        </Link>
      ) : showCreateMenu ? (
        <div className="flex flex-1 items-center justify-center">
          <PopoverMenu
            label="Create"
            align="center"
            placement="top"
            panelClassName="w-52"
            triggerClassName="forge-nav-item flex flex-col items-center justify-center gap-1 py-3 text-xs text-on-surface-variant"
            trigger={
              <>
                <Icon name="add_circle" className="text-xl" />
                Create
              </>
            }
          >
            {(close) => (
              <>
                {canUpload ? (
                  <>
                    <Link
                      href="/upload"
                      role="menuitem"
                      className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-container-highest"
                      onClick={close}
                    >
                      <Icon name="upload" className="text-base" />
                      Upload video
                    </Link>
                    <Link
                      href="/upload?type=short"
                      role="menuitem"
                      className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-container-highest"
                      onClick={close}
                    >
                      <Icon name="smart_display" className="text-base" />
                      Create a Short
                    </Link>
                  </>
                ) : null}
                {canGoLive ? (
                  <Link
                    href="/studio/live"
                    role="menuitem"
                    className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-container-highest"
                    onClick={close}
                  >
                    <Icon name="sensors" className="text-base" />
                    Go live
                  </Link>
                ) : null}
                {canApplyForCreator ? (
                  <Link
                    href="/upload/become-creator"
                    role="menuitem"
                    className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-container-highest"
                    onClick={close}
                  >
                    <Icon name="auto_videocam" className="text-base" />
                    Become a Creator
                  </Link>
                ) : null}
                {!canUpload && !canGoLive && !canApplyForCreator ? (
                  <Link
                    href="/studio"
                    role="menuitem"
                    className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-container-highest"
                    onClick={close}
                  >
                    <Icon name="dashboard" className="text-base" />
                    Studio
                  </Link>
                ) : null}
              </>
            )}
          </PopoverMenu>
        </div>
      ) : (
        <Link
          href="/studio"
          className="forge-nav-item flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs text-on-surface-variant"
          aria-label="Create"
        >
          <Icon name="add_circle" className="text-xl" />
          Create
        </Link>
      )}

      {renderLink(subs)}
      {renderLink(you)}
    </nav>
  );
}
