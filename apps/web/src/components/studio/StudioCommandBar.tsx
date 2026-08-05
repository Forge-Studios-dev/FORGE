'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@forge/design-system';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { PopoverMenu } from '@/components/shell/PopoverMenu';

const CREATE_ITEMS = [
  { href: '/upload', label: 'Upload video', icon: 'upload' },
  { href: '/upload?type=short', label: 'Create Short', icon: 'smart_display' },
  { href: '/studio/live', label: 'Go live', icon: 'sensors' },
  { href: '/playlists/new', label: 'New playlist', icon: 'playlist_add' },
] as const;

export function StudioCommandBar({ collaboratorMode = false }: { collaboratorMode?: boolean }) {
  const router = useRouter();
  const { user, accessToken, canEngage } = useAuth();
  const [search, setSearch] = useState('');

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread'],
    enabled: !!accessToken && canEngage,
    queryFn: async () => {
      const { data } = await api.get<{ data: { count: number } }>('/notifications/unread-count');
      return data.data.count;
    },
    staleTime: 30_000,
  });

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const q = search.trim();
    if (collaboratorMode) {
      router.push('/studio/moderation');
      return;
    }
    router.push(q ? `/studio/videos?search=${encodeURIComponent(q)}` : '/studio/videos');
  };

  return (
    <header className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low px-4 py-3">
      <form onSubmit={onSearch} className="relative min-w-[200px] flex-1">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your content"
          aria-label="Search your content"
          className="w-full rounded-full border border-outline-variant/40 bg-surface-container py-2 pl-10 pr-4 text-sm"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/notifications"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/40 text-on-surface-variant transition-colors hover:border-primary/40 hover:text-on-surface"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        >
          <Icon name="notifications" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-on-error-container">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Link>

        <Link
          href="/studio/settings"
          className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 px-2 py-1.5 text-sm transition-colors hover:border-primary/40"
        >
          {user?.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt=""
              width={28}
              height={28}
              className="rounded-full object-cover"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Icon name="person" className="text-base" />
            </span>
          )}
          <span className="hidden font-medium text-on-surface sm:inline">
            {user?.displayName ?? user?.username ?? 'Account'}
          </span>
        </Link>

        {!collaboratorMode ? (
          <PopoverMenu
            label="Create"
            align="right"
            panelClassName="w-56 p-0"
            triggerClassName="primary-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-on-primary"
            trigger={
              <>
                <Icon name="add" />
                Create
              </>
            }
          >
            {(close) =>
              CREATE_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={close}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-on-surface transition-colors hover:bg-primary/10"
                >
                  <Icon name={item.icon} className="text-primary" />
                  {item.label}
                </Link>
              ))
            }
          </PopoverMenu>
        ) : (
          <Link
            href="/studio/moderation"
            className="primary-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-on-primary"
          >
            <Icon name="shield" />
            Moderation
          </Link>
        )}
      </div>
    </header>
  );
}
