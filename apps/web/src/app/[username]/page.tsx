import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { serverApi } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import { getUserByUsernameCached } from '@/lib/get-user-by-username';
import { redirectIfStaleProfileUsername } from '@/lib/username-redirect';
import { PaginatedResponse, Playlist, Video } from '@/types';
import { ProfileHeader } from '@/components/ProfileHeader/ProfileHeader';
import { MembershipPanel } from '@/components/Membership/MembershipPanel';
import { FeedGrid } from '@/components/FeedCard/FeedGrid';
import { JsonLd } from '@/components/seo/JsonLd';
import { ChannelCommunityFeed } from '@/components/Community/ChannelCommunityFeed';

interface Props {
  params: { username: string };
  searchParams?: { tab?: string; sort?: string };
}

type ChannelTab = 'home' | 'videos' | 'shorts' | 'live' | 'playlists' | 'community' | 'about';
type ChannelVideoSort = 'newest' | 'oldest' | 'popular';

async function getUserVideos(
  userId: string,
  type: 'video' | 'short' | 'all' = 'all',
  sort: ChannelVideoSort = 'newest',
): Promise<PaginatedResponse<Video>> {
  try {
    const qs = new URLSearchParams({ limit: '24' });
    if (type !== 'all') qs.set('type', type);
    if (sort !== 'newest') qs.set('sort', sort);
    const { data } = await serverApi.get(`/users/${userId}/videos?${qs.toString()}`);
    return data.data;
  } catch {
    return { data: [], meta: { cursor: null, hasMore: false } };
  }
}

async function getUserPlaylists(userId: string): Promise<Playlist[]> {
  try {
    const { data } = await serverApi.get(`/playlists/user/${userId}`);
    return data.data ?? [];
  } catch {
    try {
      const { data } = await serverApi.get(`/users/${userId}/playlists`);
      const payload = data.data;
      if (Array.isArray(payload)) return payload;
      if (payload && Array.isArray(payload.data)) return payload.data;
      return [];
    } catch {
      return [];
    }
  }
}

type ChannelStream = {
  id: string;
  title: string;
  status: string;
  viewerCount?: number;
  scheduledAt?: string | null;
  thumbnailUrl?: string | null;
};

type ChannelPostPreview = {
  id: string;
  title?: string | null;
  body?: string | null;
  isPinned?: boolean;
  createdAt?: string;
};

async function getCreatorChannelPosts(creatorId: string): Promise<ChannelPostPreview[]> {
  try {
    const { data } = await serverApi.get(`/creators/${creatorId}/channel-posts?limit=4`);
    const root = data.data;
    const list = Array.isArray(root) ? root : Array.isArray(root?.data) ? root.data : [];
    return list as ChannelPostPreview[];
  } catch {
    return [];
  }
}

async function getCreatorLiveStreams(creatorId: string): Promise<ChannelStream[]> {
  try {
    const { data } = await serverApi.get(`/streams/live?creatorId=${creatorId}`);
    const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
    return list as ChannelStream[];
  } catch {
    return [];
  }
}

async function getCreatorUpcomingStreams(creatorId: string): Promise<ChannelStream[]> {
  try {
    const { data } = await serverApi.get(`/streams/upcoming?creatorId=${creatorId}`);
    const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
    return list as ChannelStream[];
  } catch {
    return [];
  }
}

function resolveTab(raw?: string): ChannelTab {
  if (
    raw === 'videos' ||
    raw === 'playlists' ||
    raw === 'about' ||
    raw === 'home' ||
    raw === 'shorts' ||
    raw === 'live' ||
    raw === 'community'
  ) {
    return raw;
  }
  return 'home';
}

function resolveSort(raw?: string): ChannelVideoSort {
  if (raw === 'oldest' || raw === 'popular' || raw === 'newest') return raw;
  return 'newest';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await getUserByUsernameCached(params.username);
  if (!user) return { title: 'Channel not found' };

  return {
    title: `${user.displayName} (@${user.username})`,
    description: user.bio || `${user.displayName}'s channel`,
    openGraph: {
      title: `${user.displayName}`,
      description: user.bio,
      images: user.avatarUrl ? [{ url: user.avatarUrl }] : [],
    },
  };
}

export default async function ChannelPage({ params, searchParams }: Props) {
  const user = await getUserByUsernameCached(params.username);
  if (!user) notFound();
  redirectIfStaleProfileUsername(params.username, user.username);

  const tab = resolveTab(searchParams?.tab);
  const sort = resolveSort(searchParams?.sort);
  const [videos, shortsPreview, liveStreams, upcomingStreams, homePosts] = await Promise.all([
    tab === 'shorts'
      ? getUserVideos(user.id, 'short', sort)
      : tab === 'videos' || tab === 'home'
        ? getUserVideos(user.id, 'video', tab === 'videos' ? sort : 'newest')
        : Promise.resolve({ data: [], meta: { cursor: null, hasMore: false } }),
    tab === 'home' ? getUserVideos(user.id, 'short') : Promise.resolve({ data: [], meta: { cursor: null, hasMore: false } }),
    tab === 'home' || tab === 'live' ? getCreatorLiveStreams(user.id) : Promise.resolve([]),
    tab === 'live' ? getCreatorUpcomingStreams(user.id) : Promise.resolve([]),
    tab === 'home' ? getCreatorChannelPosts(user.id) : Promise.resolve([]),
  ]);
  const playlists = tab === 'playlists' || tab === 'home' ? await getUserPlaylists(user.id) : [];
  const subscriberCount = user.subscriberCount ?? user.followerCount;

  const tabs: { id: ChannelTab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'videos', label: 'Videos' },
    { id: 'shorts', label: 'Shorts' },
    { id: 'live', label: 'Live' },
    { id: 'playlists', label: 'Playlists' },
    { id: 'community', label: 'Community' },
    { id: 'about', label: 'About' },
  ];

  return (
    <main className="min-h-screen">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          mainEntity: {
            '@type': 'Person',
            name: user.displayName,
            alternateName: user.username,
            description: user.bio || undefined,
            image: user.avatarUrl || undefined,
            url: `${SITE_URL}/${user.username}`,
          },
        }}
      />
      <ProfileHeader user={user} />

      <div className="mx-auto max-w-[var(--spacing-container-max)] border-b border-outline-variant/20 px-5 md:px-12">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Channel sections">
          {tabs.map((t) => {
            const href =
              t.id === 'home' ? `/${user.username}` : `/${user.username}?tab=${t.id}`;
            const active = tab === t.id;
            return (
              <Link
                key={t.id}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? 'border-primary text-on-surface'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <section className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
        {tab === 'home' || tab === 'videos' ? (
          <>
            {tab === 'home' ? (
              <section className="mb-10">
                <MembershipPanel creatorId={user.id} />
              </section>
            ) : null}
            {tab === 'home' && liveStreams.length > 0 ? (
              <section className="mb-10">
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h2 className="font-display-forge text-xl font-semibold">Live now</h2>
                  <Link
                    href={`/${user.username}?tab=live`}
                    className="text-sm text-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <ul className="space-y-3">
                  {liveStreams.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/live/${s.id}`}
                        className="glass-panel flex items-center justify-between gap-3 rounded-xl px-4 py-3 hover:border-primary/30"
                      >
                        <span className="font-medium text-on-surface">{s.title}</span>
                        <span className="shrink-0 rounded-full bg-error/15 px-2 py-0.5 text-xs font-semibold text-error">
                          LIVE
                          {typeof s.viewerCount === 'number' ? ` · ${s.viewerCount}` : ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {tab === 'home' && shortsPreview.data.length > 0 ? (
              <section className="mb-10">
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h2 className="font-display-forge text-xl font-semibold">Shorts</h2>
                  <Link
                    href={`/${user.username}?tab=shorts`}
                    className="text-sm text-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <FeedGrid
                  initialData={{
                    data: shortsPreview.data.slice(0, 8),
                    meta: { cursor: null, hasMore: false },
                  }}
                />
              </section>
            ) : null}
            {tab === 'home' && playlists.length > 0 ? (
              <section className="mb-10">
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h2 className="font-display-forge text-xl font-semibold">Playlists</h2>
                  <Link
                    href={`/${user.username}?tab=playlists`}
                    className="text-sm text-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <ul className="space-y-2">
                  {playlists.slice(0, 6).map((pl) => (
                    <li key={pl.id}>
                      <Link
                        href={`/playlists/${pl.id}`}
                        className="glass-panel flex items-center justify-between gap-3 rounded-xl px-4 py-3 hover:border-primary/30"
                      >
                        <span className="font-medium text-on-surface">{pl.title}</span>
                        {typeof pl.videoCount === 'number' ? (
                          <span className="shrink-0 text-xs text-outline">
                            {pl.videoCount} {pl.videoCount === 1 ? 'video' : 'videos'}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {tab === 'home' && homePosts.length > 0 ? (
              <section className="mb-10">
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h2 className="font-display-forge text-xl font-semibold">Community</h2>
                  <Link
                    href={`/${user.username}?tab=community`}
                    className="text-sm text-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <ul className="space-y-3">
                  {homePosts.slice(0, 3).map((post) => {
                    const preview =
                      (post.title && post.title.trim()) ||
                      (post.body && post.body.trim()) ||
                      'Community post';
                    return (
                      <li key={post.id}>
                        <Link
                          href={`/${user.username}?tab=community`}
                          className="glass-panel block rounded-xl px-4 py-3 hover:border-primary/30"
                        >
                          {post.isPinned ? (
                            <span className="mb-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              Pinned
                            </span>
                          ) : null}
                          <p className="line-clamp-3 text-sm text-on-surface">{preview}</p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display-forge text-xl font-semibold">
                {tab === 'home' ? 'Uploads' : 'Videos'}
              </h2>
              {tab === 'videos' ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Sort videos">
                  {(
                    [
                      ['newest', 'Newest'],
                      ['popular', 'Popular'],
                      ['oldest', 'Oldest'],
                    ] as const
                  ).map(([id, label]) => {
                    const href =
                      id === 'newest'
                        ? `/${user.username}?tab=videos`
                        : `/${user.username}?tab=videos&sort=${id}`;
                    const active = sort === id;
                    return (
                      <Link
                        key={id}
                        href={href}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          active
                            ? 'bg-primary text-on-primary'
                            : 'border border-outline-variant/40 text-on-surface-variant hover:text-on-surface'
                        }`}
                        aria-current={active ? 'true' : undefined}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
            {videos.data.length > 0 ? (
              <FeedGrid initialData={videos} />
            ) : (
              <p className="text-on-surface-variant">No videos yet.</p>
            )}
          </>
        ) : null}

        {tab === 'shorts' ? (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display-forge text-xl font-semibold">Shorts</h2>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Sort Shorts">
                {(
                  [
                    ['newest', 'Newest'],
                    ['popular', 'Popular'],
                    ['oldest', 'Oldest'],
                  ] as const
                ).map(([id, label]) => {
                  const href =
                    id === 'newest'
                      ? `/${user.username}?tab=shorts`
                      : `/${user.username}?tab=shorts&sort=${id}`;
                  const active = sort === id;
                  return (
                    <Link
                      key={id}
                      href={href}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        active
                          ? 'bg-primary text-on-primary'
                          : 'border border-outline-variant/40 text-on-surface-variant hover:text-on-surface'
                      }`}
                      aria-current={active ? 'true' : undefined}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
            {videos.data.length > 0 ? (
              <FeedGrid initialData={videos} />
            ) : (
              <p className="text-on-surface-variant">
                No Shorts yet.{' '}
                <Link href="/shorts" className="text-primary hover:underline">
                  Browse Shorts
                </Link>
              </p>
            )}
          </>
        ) : null}

        {tab === 'live' ? (
          <div className="space-y-8">
            <div>
              <h2 className="mb-4 font-display-forge text-xl font-semibold">Live now</h2>
              {liveStreams.length > 0 ? (
                <ul className="space-y-3">
                  {liveStreams.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/live/${s.id}`}
                        className="glass-panel flex items-center justify-between gap-3 rounded-xl px-4 py-3 hover:border-primary/30"
                      >
                        <span className="font-medium text-on-surface">{s.title}</span>
                        <span className="shrink-0 rounded-full bg-error/15 px-2 py-0.5 text-xs font-semibold text-error">
                          LIVE
                          {typeof s.viewerCount === 'number' ? ` · ${s.viewerCount}` : ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-on-surface-variant">Not live right now.</p>
              )}
            </div>
            <div>
              <h2 className="mb-4 font-display-forge text-xl font-semibold">Upcoming</h2>
              {upcomingStreams.length > 0 ? (
                <ul className="space-y-3">
                  {upcomingStreams.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/live/${s.id}`}
                        className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 hover:border-primary/30"
                      >
                        <span className="font-medium text-on-surface">{s.title}</span>
                        {s.scheduledAt ? (
                          <span className="text-xs text-outline">
                            {new Date(s.scheduledAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-on-surface-variant">No upcoming streams scheduled.</p>
              )}
            </div>
            <Link href="/live" className="text-sm text-primary hover:underline">
              Browse all live
            </Link>
          </div>
        ) : null}

        {tab === 'community' ? (
          <div className="space-y-4">
            <h2 className="font-display-forge text-xl font-semibold">Community</h2>
            <ChannelCommunityFeed creatorId={user.id} username={user.username} />
          </div>
        ) : null}

        {tab === 'playlists' ? (
          <>
            <h2 className="mb-6 font-display-forge text-xl font-semibold">Playlists</h2>
            {playlists.length > 0 ? (
              <ul className="space-y-2">
                {playlists.map((pl) => (
                  <li key={pl.id}>
                    <Link
                      href={`/playlists/${pl.id}`}
                      className="glass-panel flex items-center justify-between gap-3 rounded-xl px-4 py-3 hover:border-primary/30"
                    >
                      <span className="font-medium text-on-surface">{pl.title}</span>
                      {typeof pl.videoCount === 'number' ? (
                        <span className="shrink-0 text-xs text-outline">
                          {pl.videoCount} {pl.videoCount === 1 ? 'video' : 'videos'}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-on-surface-variant">No public playlists yet.</p>
            )}
          </>
        ) : null}

        {tab === 'about' ? (
          <div className="max-w-2xl space-y-6">
            <h2 className="font-display-forge text-xl font-semibold">About</h2>
            {user.bio ? (
              <p className="whitespace-pre-wrap text-on-surface-variant">{user.bio}</p>
            ) : (
              <p className="text-on-surface-variant">No channel description yet.</p>
            )}
            {(user.websiteUrl || (user.channelLinks?.length ?? 0) > 0) ? (
              <div>
                <h3 className="font-label-caps text-xs text-outline">Links</h3>
                <ul className="mt-3 space-y-2">
                  {user.websiteUrl ? (
                    <li>
                      <a
                        href={user.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Website
                      </a>
                    </li>
                  ) : null}
                  {(user.channelLinks ?? []).map((link) => (
                    <li key={`${link.title}-${link.url}`}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {link.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-on-surface-variant">Subscribers</dt>
                <dd className="text-lg font-semibold">{subscriberCount}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Videos</dt>
                <dd className="text-lg font-semibold">{user.videoCount}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Joined</dt>
                <dd className="font-semibold">
                  {new Date(user.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </section>
    </main>
  );
}
