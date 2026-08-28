'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { Icon, IconButton, buttonClassName } from '@forge/design-system';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { SocketEvents } from '@forge/shared-types';
import { NotificationsMenu } from '@/components/shell/NotificationsMenu';
import { SearchSuggest } from '@/components/shell/SearchSuggest';
import { PopoverMenu } from '@/components/shell/PopoverMenu';
import { useTheme } from '@/components/theme/ThemeProvider';

const menuItemClass =
  'flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-surface-container-highest';

export function TopBar() {
  const {
    user,
    isGuest,
    isLoading,
    logout,
    canUpload,
    canGoLive,
    canEngage,
    canApplyForCreator,
    accessToken,
  } = useAuth();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const showAuth = !isLoading && !isGuest;

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread'],
    enabled: !!accessToken && canEngage,
    queryFn: async () => {
      const { data } = await api.get<{ data: { count: number } }>('/notifications/unread-count');
      return data.data.count;
    },
    refetchInterval: () => {
      const socket = accessToken ? getSocket(accessToken) : null;
      if (socket?.connected) return false;
      return 60_000;
    },
  });

  useEffect(() => {
    if (!accessToken || !canEngage) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    const onNew = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on(SocketEvents.NOTIFICATION_NEW, onNew);
    return () => {
      socket.off(SocketEvents.NOTIFICATION_NEW, onNew);
    };
  }, [accessToken, canEngage, queryClient]);

  return (
    <nav className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-outline-variant/20 bg-surface/60 px-5 backdrop-blur-[30px] md:px-12">
      <Link href="/" className="font-display-forge text-xl font-bold tracking-tighter text-primary md:text-2xl">
        FORGE
      </Link>

      <SearchSuggest className="mx-4 hidden max-w-xl flex-1 md:block" />

      <div className="flex items-center gap-2 md:gap-4">
        <IconButton
          icon={theme === 'dark' ? 'light_mode' : 'dark_mode'}
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleTheme}
        />
        {isLoading ? (
          <div className="hidden h-10 w-40 animate-pulse rounded-full bg-surface-container-high md:block" aria-hidden />
        ) : !showAuth ? (
          <>
            <Link href="/login" className="rounded-full px-3 py-2 text-sm text-on-surface-variant hover:text-on-surface md:px-4">
              Sign in
            </Link>
            <Link href="/signup" className={`${buttonClassName('primary')} hidden md:block`}>
              Join FORGE
            </Link>
          </>
        ) : (
          <>
            {canApplyForCreator && (
              <Link
                href="/upload/become-creator"
                className="font-label-caps hidden rounded-full border border-primary/40 px-4 py-2 text-xs text-primary hover:bg-primary/10 md:block"
              >
                Become a Creator
              </Link>
            )}
            {(canUpload || canGoLive) && (
              <div className="hidden md:block">
                <PopoverMenu
                  label="Create"
                  align="right"
                  panelClassName="w-52"
                  triggerClassName="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest/50"
                  trigger={<Icon name="add_circle" />}
                >
                  {(close) => (
                    <>
                      {canUpload ? (
                        <>
                          <Link
                            href="/upload"
                            role="menuitem"
                            className={menuItemClass}
                            onClick={close}
                          >
                            <Icon name="upload" className="text-base" />
                            Upload video
                          </Link>
                          <Link
                            href="/upload?type=short"
                            role="menuitem"
                            className={menuItemClass}
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
                          className={menuItemClass}
                          onClick={close}
                        >
                          <Icon name="sensors" className="text-base" />
                          Go live
                        </Link>
                      ) : null}
                    </>
                  )}
                </PopoverMenu>
              </div>
            )}
            {canEngage && (
              <>
                <Link
                  href="/messages"
                  className="hidden h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest/50 md:flex"
                  aria-label="Messages"
                >
                  <Icon name="mail" />
                </Link>
                <NotificationsMenu unreadCount={unreadCount} />
              </>
            )}
            <PopoverMenu
              label="Account menu"
              align="right"
              panelClassName="w-56"
              triggerClassName="ml-1 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-subtle bg-surface-container-high hover:border-primary"
              trigger={
                user?.avatarUrl ? (
                  <Image src={user.avatarUrl} alt="" width={40} height={40} className="h-full w-full object-cover" />
                ) : (
                  <Icon name="person" className="text-on-surface-variant" />
                )
              }
            >
              {(close) => (
                <>
                  <Link
                    href={user?.username ? `/${user.username}` : '/profile'}
                    role="menuitem"
                    className={menuItemClass}
                    onClick={close}
                  >
                    Your channel
                  </Link>
                  <Link href="/studio" role="menuitem" className={menuItemClass} onClick={close}>
                    Studio
                  </Link>
                  <Link href="/library" role="menuitem" className={menuItemClass} onClick={close}>
                    Library
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      toggleTheme();
                      close();
                    }}
                    className={`${menuItemClass} md:hidden`}
                  >
                    {theme === 'dark' ? 'Light theme' : 'Dark theme'}
                  </button>
                  <Link
                    href="/profile/settings"
                    role="menuitem"
                    className={menuItemClass}
                    onClick={close}
                  >
                    Settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      close();
                      void logout();
                    }}
                    className={`${menuItemClass} text-on-surface-variant`}
                  >
                    Sign out
                  </button>
                </>
              )}
            </PopoverMenu>
          </>
        )}
        <Link
          href="/search"
          aria-label="Search"
          className="flex h-10 w-10 items-center justify-center text-on-surface-variant md:hidden"
        >
          <Icon name="search" />
        </Link>
      </div>
    </nav>
  );
}
