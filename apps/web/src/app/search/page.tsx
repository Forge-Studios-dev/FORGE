'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { EmptyState, FeedGridSkeleton, Icon, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { trackSearchQuery } from '@/lib/analytics';
import { Stream, User, Video } from '@/types';
import { FeedCard } from '@/components/FeedCard/FeedCard';

type SearchType = 'all' | 'video' | 'channel' | 'playlist';
type SearchDuration = 'any' | 'short' | 'medium' | 'long';
type SearchUploaded = 'any' | 'hour' | 'today' | 'week' | 'month' | 'year';
type SearchSort = 'relevance' | 'date' | 'views';
type SearchCaptions = 'any' | 'yes';
type SearchKind = 'any' | 'video' | 'short';
type SearchLive = 'any' | 'yes';
type SearchWatched = 'any' | 'watched' | 'unwatched';

type SearchPlaylist = {
  id: string;
  title: string;
  description?: string | null;
  owner?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
};

type SearchPayload = {
  videos: Video[];
  users: User[];
  playlists?: SearchPlaylist[];
  meta: { q: string; type?: SearchType };
};

const TYPE_FILTERS: { value: SearchType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Videos' },
  { value: 'channel', label: 'Channels' },
  { value: 'playlist', label: 'Playlists' },
];

const DURATION_FILTERS: { value: SearchDuration; label: string }[] = [
  { value: 'any', label: 'Any length' },
  { value: 'short', label: 'Under 4 min' },
  { value: 'medium', label: '4–20 min' },
  { value: 'long', label: 'Over 20 min' },
];

const UPLOADED_FILTERS: { value: SearchUploaded; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'hour', label: 'Last hour' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
];

const SORT_FILTERS: { value: SearchSort; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Upload date' },
  { value: 'views', label: 'View count' },
];

const CAPTIONS_FILTERS: { value: SearchCaptions; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'yes', label: 'Subtitles/CC' },
];

const KIND_FILTERS: { value: SearchKind; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'video', label: 'Videos' },
  { value: 'short', label: 'Shorts' },
];

const LIVE_FILTERS: { value: SearchLive; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'yes', label: 'Live' },
];

const WATCHED_FILTERS: { value: SearchWatched; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'watched', label: 'Watched' },
  { value: 'unwatched', label: 'Not watched' },
];

type SearchQuery = {
  q: string;
  type: SearchType;
  duration: SearchDuration;
  uploaded: SearchUploaded;
  sort: SearchSort;
  captions: SearchCaptions;
  kind: SearchKind;
  live: SearchLive;
  watched: SearchWatched;
};

function buildSearchHref({
  q,
  type,
  duration,
  uploaded,
  sort,
  captions,
  kind,
  live,
  watched,
}: SearchQuery): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (type !== 'all') params.set('type', type);
  if (duration !== 'any') params.set('duration', duration);
  if (uploaded !== 'any') params.set('uploaded', uploaded);
  if (sort !== 'relevance') params.set('sort', sort);
  if (captions !== 'any') params.set('captions', captions);
  if (kind !== 'any') params.set('kind', kind);
  if (live !== 'any') params.set('live', live);
  if (watched !== 'any') params.set('watched', watched);
  const qs = params.toString();
  return qs ? `/search?${qs}` : '/search';
}

function FilterChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusOption(index: number) {
    const opt = options[(index + options.length) % options.length];
    refs.current[opt.value]?.focus();
    onChange(opt.value);
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="radiogroup"
      aria-label={label}
      aria-orientation="horizontal"
    >
      <span className="font-label-caps mr-1 text-outline" id={`${label}-legend`}>
        {label}
      </span>
      {options.map((f, i) => {
        const active = value === f.value;
        return (
          <button
            key={f.value}
            ref={(el) => {
              refs.current[f.value] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(f.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                focusOption(i + 1);
              }
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                focusOption(i - 1);
              }
              if (e.key === 'Home') {
                e.preventDefault();
                focusOption(0);
              }
              if (e.key === 'End') {
                e.preventDefault();
                focusOption(options.length - 1);
              }
            }}
            className={`rounded-full px-3 py-1 text-sm ${
              active
                ? 'bg-on-surface text-surface'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
            }`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

function SearchResults({ q, type, duration, uploaded, sort, captions, kind, live, watched }: SearchQuery) {
  const includeCatalog = live !== 'yes';
  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', q, type, duration, uploaded, sort, captions, kind, watched],
    enabled: q.length >= 2 && includeCatalog,
    queryFn: async () => {
      const { data } = await api.get<{ data: SearchPayload }>('/search', {
        params: {
          q,
          limit: 24,
          type,
          ...(duration !== 'any' ? { duration } : {}),
          ...(uploaded !== 'any' ? { uploaded } : {}),
          ...(sort !== 'relevance' ? { sort } : {}),
          ...(captions !== 'any' ? { captions } : {}),
          ...(kind !== 'any' ? { kind } : {}),
          ...(watched !== 'any' ? { watched } : {}),
        },
      });
      const payload = data.data;
      const playlistCount = payload.playlists?.length ?? 0;
      trackSearchQuery(payload.videos.length + payload.users.length + playlistCount);
      return payload;
    },
  });

  const liveQuery = useQuery({
    queryKey: ['search-live', q],
    enabled: q.length >= 2 && (live === 'yes' || type === 'all'),
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: Stream[] }>('/streams/live');
      const term = q.toLowerCase();
      return (data.data ?? []).filter((s) => {
        const title = s.title?.toLowerCase() ?? '';
        const channel =
          s.user?.displayName?.toLowerCase() ?? s.user?.username?.toLowerCase() ?? '';
        return title.includes(term) || channel.includes(term);
      });
    },
  });

  if (q.length > 0 && q.length < 2) {
    return (
      <EmptyState
        icon="search"
        title="Keep typing"
        description="Enter at least 2 characters to search videos, channels, and playlists."
      />
    );
  }

  if (!q) {
    return (
      <EmptyState
        icon="travel_explore"
        title="Search FORGE"
        description="Find videos, channels, playlists, and live streams."
      />
    );
  }

  if ((includeCatalog && isLoading) || (live !== 'any' && liveQuery.isLoading)) {
    return <FeedGridSkeleton count={6} />;
  }

  if (includeCatalog && (isError || !data)) {
    return (
      <EmptyState
        icon="error"
        title="Search failed"
        description="Something went wrong. Check your connection and try again."
        action={{
          label: 'Retry',
          href: buildSearchHref({ q, type, duration, uploaded, sort, captions, kind, live, watched }),
        }}
      />
    );
  }

  const playlists = data?.playlists ?? [];
  const videos = includeCatalog ? (data?.videos ?? []) : [];
  const users = includeCatalog ? (data?.users ?? []) : [];
  const liveStreams = liveQuery.data ?? [];
  const empty =
    videos.length === 0 && users.length === 0 && playlists.length === 0 && liveStreams.length === 0;

  if (empty) {
    return (
      <EmptyState
        icon="search_off"
        title="No results"
        description={`Nothing matched "${q}". Try different keywords or clear filters.`}
        action={{ label: 'Go home', href: '/' }}
      />
    );
  }

  return (
    <div className="space-y-10">
      {liveStreams.length > 0 ? (
        <section>
          <h2 className="font-label-caps mb-4 text-outline">Live</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liveStreams.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/live/${s.id}`}
                  className="glass-panel flex items-center gap-3 rounded-xl p-4 transition hover:border-error/40"
                >
                  <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-surface-container-high">
                    {s.thumbnailUrl ? (
                      <Image src={s.thumbnailUrl} alt="" fill className="object-cover" sizes="112px" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Icon name="sensors" className="text-2xl text-error" />
                      </div>
                    )}
                    <span className="absolute left-1 top-1 rounded bg-error px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                      Live
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.title}</p>
                    <p className="truncate text-sm text-on-surface-variant">
                      {s.user?.displayName ?? 'Channel'}
                      {s.viewerCount != null ? ` · ${s.viewerCount} watching` : ''}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {videos.length > 0 && (
        <section>
          <h2 className="font-label-caps mb-4 text-outline">Videos</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((video) => (
              <FeedCard key={video.id} video={video} />
            ))}
          </div>
        </section>
      )}

      {users.length > 0 && (
        <section>
          <h2 className="font-label-caps mb-4 text-outline">Channels</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {users.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/${u.username}`}
                  className="glass-panel flex items-center gap-3 rounded-xl p-4 transition hover:border-primary/30"
                >
                  {u.avatarUrl ? (
                    <Image src={u.avatarUrl} alt="" width={48} height={48} className="rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-lg font-bold text-on-primary">
                      {u.displayName[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.displayName}</p>
                    <p className="text-sm text-on-surface-variant">@{u.username}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {playlists.length > 0 && (
        <section>
          <h2 className="font-label-caps mb-4 text-outline">Playlists</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {playlists.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/playlists/${p.id}`}
                  className="glass-panel flex items-center gap-3 rounded-xl p-4 transition hover:border-primary/30"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface-variant">
                    <Icon name="list" className="text-2xl" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.title}</p>
                    {p.owner ? (
                      <p className="truncate text-sm text-on-surface-variant">
                        {p.owner.displayName}
                      </p>
                    ) : p.description ? (
                      <p className="truncate text-sm text-on-surface-variant">{p.description}</p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isGuest } = useAuth();
  const q = (searchParams.get('q') || '').trim();
  const typeParam = searchParams.get('type');
  const type: SearchType =
    typeParam === 'video' || typeParam === 'channel' || typeParam === 'playlist'
      ? typeParam
      : 'all';
  const durationParam = searchParams.get('duration');
  const duration: SearchDuration =
    durationParam === 'short' || durationParam === 'medium' || durationParam === 'long'
      ? durationParam
      : 'any';
  const uploadedParam = searchParams.get('uploaded');
  const uploaded: SearchUploaded =
    uploadedParam === 'hour' ||
    uploadedParam === 'today' ||
    uploadedParam === 'week' ||
    uploadedParam === 'month' ||
    uploadedParam === 'year'
      ? uploadedParam
      : 'any';
  const sortParam = searchParams.get('sort');
  const sort: SearchSort =
    sortParam === 'date' || sortParam === 'views' || sortParam === 'relevance'
      ? sortParam
      : 'relevance';
  const captionsParam = searchParams.get('captions');
  const captions: SearchCaptions = captionsParam === 'yes' ? 'yes' : 'any';
  const kindParam = searchParams.get('kind');
  const kind: SearchKind =
    kindParam === 'video' || kindParam === 'short' ? kindParam : 'any';
  const liveParam = searchParams.get('live');
  const live: SearchLive = liveParam === 'yes' ? 'yes' : 'any';
  const watchedParam = searchParams.get('watched');
  const watched: SearchWatched =
    !isGuest && (watchedParam === 'watched' || watchedParam === 'unwatched')
      ? watchedParam
      : 'any';
  const [input, setInput] = useState(q);
  const typeTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const pushSearch = (next: Partial<SearchQuery> & { q?: string }) => {
    router.push(
      buildSearchHref({
        q: next.q ?? q,
        type: next.type ?? type,
        duration: next.duration ?? duration,
        uploaded: next.uploaded ?? uploaded,
        sort: next.sort ?? sort,
        captions: next.captions ?? captions,
        kind: next.kind ?? kind,
        live: next.live ?? live,
        watched: next.watched ?? watched,
      }),
    );
  };

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <PageHeader title="Search" subtitle="Find videos, channels, and playlists" />

      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          pushSearch({ q: input.trim() });
        }}
      >
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search videos, channels, playlists…"
            className="pl-11"
          />
        </div>
        <button type="submit" className="primary-button shrink-0 rounded-full px-6 py-2.5 text-sm font-semibold text-on-primary">
          Search
        </button>
      </form>

      {q.length >= 2 ? (
        <div className="mb-8 space-y-3">
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label="Result type"
            aria-orientation="horizontal"
          >
            {TYPE_FILTERS.map((f, i) => {
              const active = type === f.value;
              const focusTypeTab = (index: number) => {
                const tab = TYPE_FILTERS[(index + TYPE_FILTERS.length) % TYPE_FILTERS.length];
                typeTabRefs.current[tab.value]?.focus();
                pushSearch({ type: tab.value });
              };
              return (
                <button
                  key={f.value}
                  ref={(el) => {
                    typeTabRefs.current[f.value] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => pushSearch({ type: f.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      focusTypeTab(i + 1);
                    }
                    if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      focusTypeTab(i - 1);
                    }
                    if (e.key === 'Home') {
                      e.preventDefault();
                      focusTypeTab(0);
                    }
                    if (e.key === 'End') {
                      e.preventDefault();
                      focusTypeTab(TYPE_FILTERS.length - 1);
                    }
                  }}
                  className={`rounded-full px-4 py-1.5 text-sm ${
                    active
                      ? 'bg-on-surface text-surface'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          {(type === 'all' || type === 'video') && (
            <>
              <FilterChipRow
                label="Duration"
                options={DURATION_FILTERS}
                value={duration}
                onChange={(next) => pushSearch({ duration: next })}
              />
              <FilterChipRow
                label="Upload date"
                options={UPLOADED_FILTERS}
                value={uploaded}
                onChange={(next) => pushSearch({ uploaded: next })}
              />
              <FilterChipRow
                label="Sort by"
                options={SORT_FILTERS}
                value={sort}
                onChange={(next) => pushSearch({ sort: next })}
              />
              <FilterChipRow
                label="Type"
                options={KIND_FILTERS}
                value={kind}
                onChange={(next) => pushSearch({ kind: next })}
              />
              <FilterChipRow
                label="Features"
                options={CAPTIONS_FILTERS}
                value={captions}
                onChange={(next) => pushSearch({ captions: next })}
              />
              <FilterChipRow
                label="Broadcast"
                options={LIVE_FILTERS}
                value={live}
                onChange={(next) => pushSearch({ live: next })}
              />
              {!isGuest ? (
                <FilterChipRow
                  label="Watch history"
                  options={WATCHED_FILTERS}
                  value={watched}
                  onChange={(next) => pushSearch({ watched: next })}
                />
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <SearchResults
        q={q}
        type={type}
        duration={duration}
        uploaded={uploaded}
        sort={sort}
        captions={captions}
        kind={kind}
        live={live}
        watched={watched}
      />
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="px-5 py-12 text-on-surface-variant">Loading search…</p>}>
      <SearchPageContent />
    </Suspense>
  );
}
