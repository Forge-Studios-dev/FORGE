'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@forge/design-system';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { SocketEvents } from '@forge/shared-types';

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const showAuth = !isLoading && !isGuest;

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread'],
    enabled: !!accessToken && canEngage,
    queryFn: async () => {
      const { data } = await api.get<{ data: { count: number } }>('/notifications/unread-count');
      return data.data.count;
    },
    refetchInterval: 60_000,
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

      <form
        className="group relative mx-4 hidden max-w-xl flex-1 md:flex"
        onSubmit={(e) => {
          e.preventDefault();
          const q = new FormData(e.currentTarget).get('q') as string;
          router.push(`/search?q=${encodeURIComponent(q || '')}`);
        }}
      >
        <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary" />
        <input
          name="q"
          className="w-full rounded-full border border-subtle bg-surface-container-low py-2 pl-12 pr-4 text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Search skills, creators, or topics..."
        />
      </form>

      <div className="flex items-center gap-2 md:gap-4">
        {isLoading ? (
          <div className="hidden h-10 w-40 animate-pulse rounded-full bg-surface-container-high md:block" aria-hidden />
        ) : !showAuth ? (
          <>
            <Link href="/login" className="hidden rounded-full px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface md:block">
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
            {canGoLive && (
              <Link
                href="/studio/live"
                className="hidden h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest/50 md:flex"
                title="Go live"
                aria-label="Go live"
              >
                <Icon name="sensors" />
              </Link>
            )}
            {canUpload && (
              <Link href="/upload" className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest/50" title="Upload">
                <Icon name="add_circle" />
              </Link>
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
                <Link
                  href="/notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest/50"
                  aria-label="Notifications"
                >
                  <Icon name="notifications" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-on-error">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              </>
            )}
            <Link
              href={user?.username ? `/${user.username}` : '/profile'}
              className="ml-1 h-10 w-10 overflow-hidden rounded-full border border-subtle hover:border-primary bg-surface-container-high flex items-center justify-center"
            >
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Icon name="person" className="text-on-surface-variant" />
              )}
            </Link>
            <button type="button" onClick={() => logout()} className="hidden text-xs text-outline hover:text-on-surface md:block">
              Log out
            </button>
          </>
        )}
        <Link href="/search" className="flex h-10 w-10 items-center justify-center text-on-surface-variant md:hidden">
          <Icon name="search" />
        </Link>
      </div>
    </nav>
  );
}
