import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShortsFeed } from './ShortsFeed';
import type { Video } from '@/types';

const apiGet = vi.fn();
const apiPost = vi.fn();

// Mocked by relative path — vi.mock's specifier matching runs before
// vite-tsconfig-paths resolves the `@/` alias, so an aliased specifier here
// would silently miss ShortsFeed.tsx's `@/lib/*` / `@/components/*` imports.
vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

let currentUser: { id: string; isVerified?: boolean } | null = { id: 'me', isVerified: true };
let isGuest = false;
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: currentUser, isGuest }),
}));

let blockReason: 'guest' | 'unverified' | null = null;
vi.mock('../../lib/engage-access', () => ({
  getEngageBlockReason: () => blockReason,
  engageBlockedMessage: (reason: 'guest' | 'unverified' | null) =>
    reason === 'unverified'
      ? 'Verify your email to like, comment, and subscribe.'
      : 'Sign in to like, comment, and subscribe.',
}));

const toggleVideoLike = vi.fn().mockResolvedValue(undefined);
const toggleVideoDislike = vi.fn().mockResolvedValue(undefined);
const toggleSubscribe = vi.fn().mockResolvedValue(undefined);
const setChannelNotifyLevel = vi.fn().mockResolvedValue(undefined);
const toggleWatchLater = vi.fn().mockResolvedValue(undefined);
const isInWatchLater = vi.fn().mockResolvedValue(false);
const getChannelSubscription = vi.fn().mockResolvedValue({ subscribed: false, notifyLevel: null });
const blockUser = vi.fn().mockResolvedValue(undefined);

vi.mock('../../lib/engage-mutations', () => ({
  engageErrorReason: () => 'failed',
  getChannelSubscription: (...args: unknown[]) => getChannelSubscription(...args),
  isInWatchLater: (...args: unknown[]) => isInWatchLater(...args),
  blockUser: (...args: unknown[]) => blockUser(...args),
  setChannelNotifyLevel: (...args: unknown[]) => setChannelNotifyLevel(...args),
  toggleSubscribe: (...args: unknown[]) => toggleSubscribe(...args),
  toggleVideoDislike: (...args: unknown[]) => toggleVideoDislike(...args),
  toggleVideoLike: (...args: unknown[]) => toggleVideoLike(...args),
  toggleWatchLater: (...args: unknown[]) => toggleWatchLater(...args),
}));

let searchParamsString = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('../VideoPlayer/VideoPlayerLazy', () => ({
  VideoPlayer: ({ videoId }: { videoId: string }) => <div data-testid={`player-${videoId}`} />,
}));

vi.mock('../Comments/CommentsPanel', () => ({
  CommentsPanel: ({ videoId }: { videoId: string }) => <div>Comments for {videoId}</div>,
}));

vi.mock('../playlists/SaveToPlaylistModal', () => ({
  SaveToPlaylistModal: () => null,
}));

vi.mock('../watch/ReportContentButton', () => ({
  ReportContentButton: () => (
    <button type="button" role="menuitem">
      Report
    </button>
  ),
}));

function makeVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: 'v1',
    title: 'A short',
    userId: 'creator-1',
    status: 'ready',
    hlsUrl: 'https://cdn.example/v1/master.m3u8',
    thumbnailUrl: null,
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    durationSeconds: 30,
    videoType: 'short',
    createdAt: new Date().toISOString(),
    visibility: 'public',
    user: { id: 'creator-1', username: 'creator', displayName: 'Creator' } as Video['user'],
    ...overrides,
  } as Video;
}

function mockShortsFeed(videos: Video[]) {
  apiGet.mockImplementation(async (url: string) => {
    if (url.startsWith('/videos/shorts')) {
      return { data: { data: { data: videos, nextCursor: null } } };
    }
    throw new Error(`Unexpected api.get(${url})`);
  });
}

function renderFeed() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ShortsFeed />
    </QueryClientProvider>,
  );
}

// jsdom doesn't implement scrollable-element methods; ShortsFeed calls these
// from effects (deep-link scroll, arrow-key nav) that fire during/after render.
HTMLElement.prototype.scrollTo = vi.fn();
HTMLElement.prototype.scrollBy = vi.fn();

describe('ShortsFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { id: 'me', isVerified: true };
    isGuest = false;
    blockReason = null;
    searchParamsString = '';
    mockShortsFeed([makeVideo()]);
  });

  it('shows a loading skeleton while the feed is fetching', () => {
    apiGet.mockImplementation(() => new Promise(() => {}));
    const { container } = renderFeed();

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it("shows an error state when the feed fails to load", async () => {
    apiGet.mockRejectedValue(new Error('network down'));
    renderFeed();

    expect(await screen.findByText("Couldn't load Shorts")).toBeInTheDocument();
  });

  it('shows an empty state when there are no shorts', async () => {
    mockShortsFeed([]);
    renderFeed();

    expect(await screen.findByText('No Shorts yet')).toBeInTheDocument();
  });

  it('renders the active slide with the video player and inactive slides with a thumbnail', async () => {
    mockShortsFeed([
      makeVideo({ id: 'v1', title: 'First short', thumbnailUrl: null }),
      makeVideo({ id: 'v2', title: 'Second short', thumbnailUrl: 'https://cdn.example/v2.jpg' }),
    ]);
    renderFeed();

    await screen.findByTestId('player-v1');
    expect(screen.queryByTestId('player-v2')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Second short' })).toBeInTheDocument();
  });

  it('likes a video optimistically and calls the mutation', async () => {
    mockShortsFeed([makeVideo({ likeCount: 2 })]);
    const user = userEvent.setup();
    renderFeed();

    await screen.findByTestId('player-v1');
    const likeBtn = screen.getByRole('button', { name: 'Like' });
    await user.click(likeBtn);

    expect(screen.getByRole('button', { name: 'Unlike' })).toHaveTextContent('3');
    await waitFor(() => expect(toggleVideoLike).toHaveBeenCalledWith('v1', false));
  });

  it('clears an existing like when disliking', async () => {
    mockShortsFeed([makeVideo({ likeCount: 2, viewerLiked: true })]);
    const user = userEvent.setup();
    renderFeed();

    await screen.findByTestId('player-v1');
    expect(screen.getByRole('button', { name: 'Unlike' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dislike' }));

    expect(screen.getByRole('button', { name: 'Like' })).toHaveTextContent('1');
    await waitFor(() => expect(toggleVideoDislike).toHaveBeenCalledWith('v1', false));
  });

  it('subscribes, then changes the notify level from the subscription menu', async () => {
    const user = userEvent.setup();
    renderFeed();

    await screen.findByTestId('player-v1');
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));
    await waitFor(() => expect(toggleSubscribe).toHaveBeenCalledWith('creator-1', false));

    await user.click(await screen.findByRole('button', { name: 'Subscription options' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'None' }));

    await waitFor(() => expect(setChannelNotifyLevel).toHaveBeenCalledWith('creator-1', 'none'));
  });

  it('unsubscribes after confirming', async () => {
    mockShortsFeed([makeVideo({ viewerSubscribed: true })]);
    const user = userEvent.setup();
    renderFeed();

    await user.click(await screen.findByRole('button', { name: 'Subscription options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Unsubscribe' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Unsubscribe' }));

    await waitFor(() => expect(toggleSubscribe).toHaveBeenCalledWith('creator-1', true));
  });

  it('hides the subscribe control on your own video', async () => {
    currentUser = { id: 'creator-1', isVerified: true };
    renderFeed();

    await screen.findByTestId('player-v1');
    expect(screen.queryByRole('button', { name: 'Subscribe' })).not.toBeInTheDocument();
  });

  it('routes guests to the shared feed-level sign-in prompt instead of performing the action', async () => {
    isGuest = true;
    currentUser = null;
    blockReason = 'guest';
    const user = userEvent.setup();
    renderFeed();

    await screen.findByTestId('player-v1');
    await user.click(screen.getByRole('button', { name: 'Like' }));

    expect(await screen.findByText('Sign in to like, save, and subscribe on Shorts.')).toBeInTheDocument();
    expect(toggleVideoLike).not.toHaveBeenCalled();
  });

  it('shows the per-slide verify-email prompt for an unverified signed-in user', async () => {
    currentUser = { id: 'me', isVerified: false };
    blockReason = 'unverified';
    const user = userEvent.setup();
    renderFeed();

    await screen.findByTestId('player-v1');
    await user.click(screen.getByRole('button', { name: 'Like' }));

    expect(
      await screen.findByText('Verify your email to like, comment, and subscribe.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Sign in to like, save, and subscribe on Shorts.'),
    ).not.toBeInTheDocument();
    expect(toggleVideoLike).not.toHaveBeenCalled();
  });

  it('removes a video from the feed after blocking its creator', async () => {
    const user = userEvent.setup();
    renderFeed();

    await screen.findByTestId('player-v1');
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Block user' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Block' }));

    await waitFor(() => expect(blockUser).toHaveBeenCalledWith('creator-1'));
    expect(await screen.findByText('No Shorts yet')).toBeInTheDocument();
  });

  it('removes a video via Not interested without a confirmation step', async () => {
    apiPost.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderFeed();

    await screen.findByTestId('player-v1');
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Not interested' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/videos/v1/not-interested'));
    expect(await screen.findByText('No Shorts yet')).toBeInTheDocument();
  });

  it('saves a video to Watch later', async () => {
    const user = userEvent.setup();
    renderFeed();

    await screen.findByTestId('player-v1');
    await user.click(screen.getByRole('button', { name: 'Save to Watch later' }));

    expect(await screen.findByRole('button', { name: 'Remove from Watch later' })).toBeInTheDocument();
    await waitFor(() => expect(toggleWatchLater).toHaveBeenCalledWith('v1', false));
  });

  it('falls back to copying the link when the Web Share API is unavailable', async () => {
    // jsdom provides a real navigator.clipboard (unlike navigator.share, which
    // is genuinely undefined) — spy on its method rather than replacing the
    // property, since jsdom's Clipboard accessor can't be shadowed.
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderFeed();

    await screen.findByTestId('player-v1');
    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(await screen.findByText('Link copied')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/shorts?v=v1'));
  });

  it('pins a deep-linked video to the front of the feed', async () => {
    searchParamsString = 'v=pinned1';
    apiGet.mockImplementation(async (url: string) => {
      if (url.startsWith('/videos/shorts')) {
        return { data: { data: { data: [makeVideo({ id: 'v1', title: 'Feed short' })], nextCursor: null } } };
      }
      if (url === '/videos/pinned1') {
        return { data: { data: makeVideo({ id: 'pinned1', title: 'Deep-linked short' }) } };
      }
      throw new Error(`Unexpected api.get(${url})`);
    });
    renderFeed();

    await screen.findByTestId('player-pinned1');
    const regions = screen.getAllByRole('region');
    expect(regions[0]).toHaveAccessibleName('Deep-linked short');
    expect(regions[1]).toHaveAccessibleName('Feed short');
  });

  it('opens the comments panel', async () => {
    const user = userEvent.setup();
    renderFeed();

    await screen.findByTestId('player-v1');
    await user.click(screen.getByRole('button', { name: 'Comments' }));

    expect(await screen.findByText('Comments for v1')).toBeInTheDocument();
  });
});
