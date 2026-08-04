'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@forge/design-system';
import { api } from '@/lib/api';

type Props = {
  className?: string;
  compact?: boolean;
};

type SuggestionPayload = {
  titles: string[];
  channels: { username: string; displayName: string }[];
};

type FlatItem =
  | { kind: 'title'; value: string }
  | { kind: 'channel'; username: string; displayName: string };

export function SearchSuggest({ className = '', compact = false }: Props) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 200);
    return () => window.clearTimeout(t);
  }, [query]);

  const { data } = useQuery({
    queryKey: ['search-suggestions', debounced],
    enabled: debounced.length >= 2 && open,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: res } = await api.get<{ data: SuggestionPayload }>(
        `/search/suggestions?q=${encodeURIComponent(debounced)}&limit=8`,
      );
      return {
        titles: res.data?.titles ?? [],
        channels: res.data?.channels ?? [],
      } satisfies SuggestionPayload;
    },
  });

  const items: FlatItem[] = [
    ...(data?.channels ?? []).map(
      (c): FlatItem => ({
        kind: 'channel',
        username: c.username,
        displayName: c.displayName,
      }),
    ),
    ...(data?.titles ?? []).map((value): FlatItem => ({ kind: 'title', value })),
  ];

  useEffect(() => {
    setActiveIndex(-1);
  }, [items.length, debounced]);

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, []);

  const goSearch = (q: string) => {
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const activate = (item: FlatItem) => {
    setOpen(false);
    if (item.kind === 'channel') {
      router.push(`/${item.username}`);
      return;
    }
    setQuery(item.value);
    goSearch(item.value);
  };

  const showList = open && debounced.length >= 2 && items.length > 0;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <form
        className="group relative"
        onSubmit={(e) => {
          e.preventDefault();
          if (activeIndex >= 0 && items[activeIndex]) {
            activate(items[activeIndex]);
            return;
          }
          goSearch(query);
        }}
      >
        <Icon
          name="search"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary"
        />
        <input
          name="q"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!showList) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, -1));
            } else if (e.key === 'Escape') {
              setOpen(false);
              setActiveIndex(-1);
            }
          }}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
          }
          aria-label="Search videos, channels, or topics"
          className={
            compact
              ? 'w-full rounded-full border border-subtle bg-surface-container-low py-2 pl-12 pr-4 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
              : 'w-full rounded-full border border-subtle bg-surface-container-low py-2 pl-12 pr-4 text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          }
          placeholder="Search videos, channels, or topics..."
          autoComplete="off"
        />
      </form>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface-container-high py-1 shadow-lg"
        >
          {items.map((item, i) => {
            const label =
              item.kind === 'channel'
                ? `${item.displayName} (@${item.username})`
                : item.value;
            return (
              <li
                key={item.kind === 'channel' ? `ch-${item.username}` : `t-${item.value}-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                id={`${listId}-opt-${i}`}
              >
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-container-highest ${
                    i === activeIndex ? 'bg-surface-container-highest' : ''
                  }`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => activate(item)}
                >
                  <Icon
                    name={item.kind === 'channel' ? 'person' : 'search'}
                    className="shrink-0 text-base text-outline"
                  />
                  <span className="min-w-0 flex-1 truncate text-on-surface">{label}</span>
                  {item.kind === 'channel' ? (
                    <span className="shrink-0 text-xs uppercase tracking-wide text-outline">
                      Channel
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
