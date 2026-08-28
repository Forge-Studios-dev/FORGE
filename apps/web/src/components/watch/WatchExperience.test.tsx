import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WatchExperience } from './WatchExperience';
import type { Video } from '@/types';

const apiGet = vi.fn();
const apiPost = vi.fn();

// Mocked by relative path — vi.mock's specifier matching runs before
// vite-tsconfig-paths resolves the `@/` alias, so an aliased specifier here
// would silently miss WatchExperience.tsx's `@/lib/*` / `@/components/*`
// imports.
vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}));

let currentUser: { id: string } | null = { id: 'me' };
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

const blockUser = vi.fn().mockResolvedValue(undefined);
vi.mock('../../lib/engage-mutations', () => ({
  blockUser: (...args: unknown[]) => blockUser(...args),
}));

const openMiniPlayer = vi.fn();
const closeMiniPlayer = vi.fn();
vi.mock('../../lib/miniplayer', () => ({
  useMiniPlayer: () => ({ open: openMiniPlayer, close: closeMiniPlayer }),
}));

vi.mock('../../lib/access-session', () => ({
  useAccessSession: () => ({ ready: true, conflict: null, takeOver: vi.fn() }),
}));

const routerPush = vi.fn();
const routerReplace = vi.fn();
let searchParamsString = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));

let capturedOnEnded: (() => void) | null = null;
vi.mock('../VideoPlayer/VideoPlayerLazy', () => ({
  VideoPlayer: (props: { hlsUrl: string; onEnded?: () => void }) => {
    capturedOnEnded = props.onEnded ?? null;
    return <div data-testid="player" data-hls-url={props.hlsUrl} />;
  },
}));

vi.mock('../VideoPlayer/VideoInfo', () => ({
  VideoInfo: ({ video }: { video: Video }) => <div>VideoInfo: {video.title}</div>,
}));

vi.mock('../Comments/CommentsPanel', () => ({
  CommentsPanel: ({ videoId }: { videoId: string }) => <div>Comments for {videoId}</div>,
}));

vi.mock('../StreamChat/StreamChatReplayPanel', () => ({
  StreamChatReplayPanel: () => <div>Stream chat replay</div>,
}));

vi.mock('../gates/AuthGateModal', () => ({
  AuthGateModal: ({ open, message }: { open: boolean; message: string }) =>
    open ? <div>{message}</div> : null,
}));

vi.mock('../gates/VerifyEmailGateModal', () => ({
  VerifyEmailGateModal: ({ open, message }: { open: boolean; message: string }) =>
    open ? <div>{message}</div> : null,
}));

vi.mock('./ReportContentButton', () => ({
  ReportContentButton: () => <button type="button">Report</button>,
}));

vi.mock('./PlaylistQueueRail', () => ({
  PlaylistQueueRail: ({ listId }: { listId: string }) => <div>Playlist queue for {listId}</div>,
}));

vi.mock('./ChaptersBar', () => ({
  ChaptersBar: () => <div>Chapters</div>,
}));

vi.mock('./TranscriptPanel', () => ({
  TranscriptPanel: () => <div>Transcript</div>,
}));

vi.mock('../Membership/MembershipPanel', () => ({
  MembershipPanel: ({ creatorId }: { creatorId: string }) => <div>Membership panel for {creatorId}</div>,
}));

vi.mock('../Community/AccessSessionConflict', () => ({
  AccessSessionConflict: () => <div>Access session conflict</div>,
}));

function makeVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: 'v1',
    userId: 'creator-1',
    title: 'My video',
    description: '',
    status: 'ready',
    visibility: 'public',
    videoType: 'video',
    hlsUrl: 'https://cdn.example/v1/master.m3u8',
    thumbnailUrl: null,
    commentCount: 0,
    durationSeconds: 300,
    createdAt: new Date().toISOString(),
    ...overrides,
  } as Video;
}

function mockRelated(next: Video | null) {
  apiGet.mockImplementation(async (url: string) => {
    if (url.includes('/related')) return { data: { data: { data: next ? [next] : [] } } };
    if (url.startsWith('/playlists/')) return { data: { data: { items: [] } } };
    if (url.includes('/membership/me')) return { data: { data: { active: true } } };
    if (url.includes('/tiers')) return { data: { data: [] } };
    throw new Error(`Unexpected api.get(${url})`);
  });
}

function renderWatch(video: Video, sidebar?: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <WatchExperience video={video} sidebar={sidebar} />
    </QueryClientProvider>,
  );
}

describe('WatchExperience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { id: 'me' };
    isGuest = false;
    blockReason = null;
    searchParamsString = '';
    capturedOnEnded = null;
    window.localStorage.clear();
    mockRelated(null);
  });

  it('shows a private-video callout for a guest', () => {
    isGuest = true;
    currentUser = null;
    renderWatch(makeVideo({ visibility: 'private' }));

    expect(screen.getByText('Private video')).toBeInTheDocument();
    expect(screen.getByText(/Sign in with the channel account/)).toBeInTheDocument();
  });

  it('shows a private-video callout for a signed-in non-owner', () => {
    currentUser = { id: 'someone-else' };
    renderWatch(makeVideo({ visibility: 'private', userId: 'creator-1' }));

    expect(screen.getByText(/do not have permission/)).toBeInTheDocument();
  });

  it('shows a paywall for access-denied videos', () => {
    renderWatch(
      makeVideo({ accessDenied: true, accessReason: 'subscription_required', userId: 'creator-1' }),
    );

    expect(screen.getByText('An active membership is required.')).toBeInTheDocument();
    expect(screen.getByText('Membership panel for creator-1')).toBeInTheDocument();
  });

  it('shows a processing message when the video is not ready', () => {
    renderWatch(makeVideo({ status: 'processing', hlsUrl: null }));

    expect(screen.getByText('Processing your video')).toBeInTheDocument();
  });

  it('shows a failure message for a failed video', () => {
    renderWatch(makeVideo({ status: 'failed', hlsUrl: null }));

    expect(screen.getByText('This upload could not be processed.')).toBeInTheDocument();
  });

  it('plays a ready video and renders comments', async () => {
    renderWatch(makeVideo());

    const player = await screen.findByTestId('player');
    expect(player).toHaveAttribute('data-hls-url', 'https://cdn.example/v1/master.m3u8');
    expect(screen.getByText('Comments for v1')).toBeInTheDocument();
  });

  it('enters theater mode and keeps comments visible', async () => {
    const user = userEvent.setup();
    renderWatch(makeVideo());

    await screen.findByTestId('player');
    expect(screen.getByText('Comments for v1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Theater mode' }));

    expect(screen.getByRole('button', { name: 'Exit theater mode' })).toBeInTheDocument();
    expect(screen.getByText('Comments for v1')).toBeInTheDocument();
    expect(window.localStorage.getItem('forge.watch.theater')).toBe('1');
  });

  it('toggles theater mode with the t key and exits with Escape', async () => {
    const user = userEvent.setup();
    renderWatch(makeVideo());

    await screen.findByTestId('player');
    await user.keyboard('t');
    expect(screen.getByRole('button', { name: 'Exit theater mode' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Exit theater mode' })).not.toBeInTheDocument();
  });

  it('persists the autoplay preference', async () => {
    const user = userEvent.setup();
    renderWatch(makeVideo());

    await screen.findByTestId('player');
    const autoplay = screen.getByRole('checkbox', { name: 'Autoplay next' });
    expect(autoplay).toBeChecked();
    await user.click(autoplay);

    expect(autoplay).not.toBeChecked();
    expect(window.localStorage.getItem('forge.watch.autoplay')).toBe('0');
  });

  it('persists the loop-video preference', async () => {
    const user = userEvent.setup();
    renderWatch(makeVideo());

    await screen.findByTestId('player');
    const loop = screen.getByRole('checkbox', { name: 'Loop video' });
    await user.click(loop);

    expect(loop).toBeChecked();
    expect(window.localStorage.getItem('forge.watch.loop')).toBe('1');
  });

  it('shows an up-next end screen and navigates on Play now', async () => {
    mockRelated(makeVideo({ id: 'next1', title: 'Next video' }));
    const user = userEvent.setup();
    renderWatch(makeVideo());

    await screen.findByTestId('player');
    await waitFor(() => expect(capturedOnEnded).not.toBeNull());
    capturedOnEnded!();

    const dialog = await screen.findByRole('dialog', { name: 'Up next' });
    expect(within(dialog).getByText('Next video')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Play now' }));

    expect(routerPush).toHaveBeenCalledWith('/watch/next1');
  });

  it('dismisses the end screen on Cancel', async () => {
    mockRelated(makeVideo({ id: 'next1', title: 'Next video' }));
    const user = userEvent.setup();
    renderWatch(makeVideo());

    await screen.findByTestId('player');
    await waitFor(() => expect(capturedOnEnded).not.toBeNull());
    capturedOnEnded!();

    const dialog = await screen.findByRole('dialog', { name: 'Up next' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Up next' })).not.toBeInTheDocument();
  });

  it('minimizes to the mini player and navigates home', async () => {
    const user = userEvent.setup();
    renderWatch(makeVideo());

    await screen.findByTestId('player');
    await user.click(screen.getByRole('button', { name: 'Miniplayer' }));

    expect(openMiniPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: 'v1', hlsUrl: 'https://cdn.example/v1/master.m3u8' }),
    );
    expect(routerPush).toHaveBeenCalledWith('/');
  });

  it('marks a video not interested and returns home', async () => {
    apiPost.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWatch(makeVideo());

    await screen.findByTestId('player');
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Not interested' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/videos/v1/not-interested'));
    expect(routerPush).toHaveBeenCalledWith('/');
  });

  it('blocks the creator after confirming', async () => {
    const user = userEvent.setup();
    renderWatch(makeVideo());

    await screen.findByTestId('player');
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Block user' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Block' }));

    await waitFor(() => expect(blockUser).toHaveBeenCalledWith('creator-1'));
    expect(routerPush).toHaveBeenCalledWith('/');
  });

  it('hides the More options menu for the video owner', async () => {
    currentUser = { id: 'creator-1' };
    renderWatch(makeVideo({ userId: 'creator-1' }));

    await screen.findByTestId('player');
    expect(screen.queryByRole('button', { name: 'More options' })).not.toBeInTheDocument();
  });

  it('shows the playlist queue instead of the sidebar when watching from a list', async () => {
    searchParamsString = 'list=pl1';
    apiGet.mockImplementation(async (url: string) => {
      if (url === '/playlists/pl1') {
        return {
          data: {
            data: {
              id: 'pl1',
              items: [{ videoId: 'v1' }, { videoId: 'v2', video: makeVideo({ id: 'v2' }) }],
            },
          },
        };
      }
      if (url.includes('/related')) return { data: { data: { data: [] } } };
      throw new Error(`Unexpected api.get(${url})`);
    });
    renderWatch(makeVideo(), <div>Fallback sidebar</div>);

    expect(await screen.findByText('Playlist queue for pl1')).toBeInTheDocument();
    expect(screen.queryByText('Fallback sidebar')).not.toBeInTheDocument();
  });

  it('toggles shuffle via router.replace when watching from a list', async () => {
    searchParamsString = 'list=pl1';
    apiGet.mockImplementation(async (url: string) => {
      if (url === '/playlists/pl1') {
        return { data: { data: { id: 'pl1', items: [{ videoId: 'v1' }, { videoId: 'v2' }] } } };
      }
      throw new Error(`Unexpected api.get(${url})`);
    });
    const user = userEvent.setup();
    renderWatch(makeVideo());

    await screen.findByTestId('player');
    await user.click(screen.getByRole('checkbox', { name: 'Shuffle' }));

    expect(routerReplace).toHaveBeenCalledWith('/watch/v1?list=pl1&shuffle=1');
  });
});
