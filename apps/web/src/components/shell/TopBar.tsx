'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { Icon, IconButton } from '@forge/design-system';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { SocketEvents } from '@forge/shared-types';
import { NotificationsMenu } from '@/components/shell/NotificationsMenu';
import { SearchSuggest } from '@/components/shell/SearchSuggest';
import { useTheme } from '@/components/theme/ThemeProvider';

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
            <Link href="/signup" className="primary-button hidden rounded-full px-5 py-2 text-sm font-semibold text-on-primary md:block">
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
              <details className="relative">
                <summary
                  className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest/50 [&::-webkit-details-marker]:hidden"
                  aria-label="Create"
                  title="Create"
                >
                  <Icon name="add_circle" />
                </summary>
                <div className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-outline-variant/30 bg-surface-container-high py-2 shadow-lg">
                  {canUpload ? (
                    <>
                      <Link
                        href="/upload"
                        className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-container-highest"
                      >
                        <Icon name="upload" className="text-base" />
                        Upload video
                      </Link>
                      <Link
                        href="/upload?type=short"
                        className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-container-highest"
                      >
                        <Icon name="smart_display" className="text-base" />
                        Create a Short
                      </Link>
                    </>
                  ) : null}
                  {canGoLive ? (
                    <Link
                      href="/studio/live"
                      className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-container-highest"
                    >
                      <Icon name="sensors" className="text-base" />
                      Go live
                    </Link>
                  ) : null}
                </div>
              </details>
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
            <details className="relative ml-1">
              <summary
                className="flex h-10 w-10 cursor-pointer list-none items-center justify-center overflow-hidden rounded-full border border-subtle bg-surface-container-high hover:border-primary [&::-webkit-details-marker]:hidden"
                aria-label="Account menu"
              >
                {user?.avatarUrl ? (
                  <Image src={user.avatarUrl} alt="" width={40} height={40} className="h-full w-full object-cover" />
                ) : (
                  <Icon name="person" className="text-on-surface-variant" />
                )}
              </summary>
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-outline-variant/30 bg-surface-container-high py-2 shadow-lg">
                <Link
                  href={user?.username ? `/${user.username}` : '/profile'}
                  className="block px-4 py-2 text-sm hover:bg-surface-container-highest"
                >
                  Your channel
                </Link>
                <Link href="/studio" className="block px-4 py-2 text-sm hover:bg-surface-container-highest">
                  Studio
                </Link>
                <Link href="/library" className="block px-4 py-2 text-sm hover:bg-surface-container-highest">
                  Library
                </Link>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-surface-container-highest md:hidden"
                >
                  {theme === 'dark' ? 'Light theme' : 'Dark theme'}
                </button>
                <Link
                  href="/profile/settings"
                  className="block px-4 py-2 text-sm hover:bg-surface-container-highest"
                >
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="block w-full px-4 py-2 text-left text-sm text-on-surface-variant hover:bg-surface-container-highest"
                >
                  Sign out
                </button>
              </div>
            </details>
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
