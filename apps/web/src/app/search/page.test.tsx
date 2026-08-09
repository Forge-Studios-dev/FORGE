import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SearchPage from './page';
import type { Video, User, Stream } from '@/types';

const apiGet = vi.fn();
const routerPush = vi.fn();
let searchParamsString = '';
let isGuest = false;

// Mocked by relative path — vi.mock's specifier matching runs before
// vite-tsconfig-paths resolves the `@/` alias, so an aliased specifier here
// would silently miss page.tsx's `@/lib/*` imports.
vi.mock('../../lib/api', () => ({
  api: { get: (...args: unknown[]) => apiGet(...args) },
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ isGuest }),
}));

vi.mock('../../lib/analytics', () => ({
  trackSearchQuery: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));

vi.mock('../../components/FeedCard/FeedCard', () => ({
  FeedCard: ({ video }: { video: Video }) => <div data-testid={`feed-card-${video.id}`}>{video.title}</div>,
}));

// api.get() stands in for axios's AxiosResponse; .data is the JSON body,
// which is TransformInterceptor's { success, data } envelope. SearchPayload
// and Stream[] have no further nested `.data`, unlike the paginated
// { data, meta } collections elsewhere — so this is two levels, not three.
function envelope<T>(body: T) {
  return { data: { data: body } };
}

function makeVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: 'v1',
    title: 'Intro to FORGE',
    userId: 'creator-1',
    thumbnailUrl: null,
    viewCount: 0,
    durationSeconds: 120,
    createdAt: new Date().toISOString(),
    visibility: 'public',
    ...overrides,
  } as Video;
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    ...overrides,
  } as User;
}

function makeStream(overrides: Partial<Stream> = {}): Stream {
  return {
    id: 's1',
    title: 'Live coding',
    userId: 'creator-1',
    user: { id: 'creator-1', username: 'creator', displayName: 'Creator' } as Stream['user'],
    viewerCount: 5,
    thumbnailUrl: null,
    ...overrides,
  } as Stream;
}

function mockSearchApi({
  videos = [],
  users = [],
  playlists = [],
  live = [],
}: {
  videos?: Video[];
  users?: User[];
  playlists?: unknown[];
  live?: Stream[];
} = {}) {
  apiGet.mockImplementation(async (url: string) => {
    if (url === '/search') {
      return envelope({ videos, users, playlists, meta: { q: '' } });
    }
    if (url === '/streams/live') {
      return envelope(live);
    }
    throw new Error(`Unexpected api.get(${url})`);
  });
}

function renderSearchPage(query: string, opts: { guest?: boolean } = {}) {
  searchParamsString = query;
  isGuest = !!opts.guest;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SearchPage />
    </QueryClientProvider>,
  );
}

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isGuest = false;
    mockSearchApi();
  });

  it('prompts to search when there is no query', async () => {
    renderSearchPage('');
    expect(await screen.findByText('Search FORGE')).toBeInTheDocument();
  });

  it('asks the user to keep typing for a single-character query', async () => {
    renderSearchPage('q=a');
    expect(await screen.findByText('Keep typing')).toBeInTheDocument();
  });

  it('renders video results', async () => {
    mockSearchApi({ videos: [makeVideo({ id: 'v1', title: 'Intro to FORGE' })] });
    renderSearchPage('q=forge');

    expect(await screen.findByTestId('feed-card-v1')).toHaveTextContent('Intro to FORGE');
  });

  it('renders channel results', async () => {
    mockSearchApi({ users: [makeUser({ username: 'alice', displayName: 'Alice' })] });
    renderSearchPage('q=alice');

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('@alice')).toBeInTheDocument();
  });

  it('renders playlist results', async () => {
    mockSearchApi({
      playlists: [{ id: 'p1', title: 'My Playlist', owner: { id: 'u1', username: 'alice', displayName: 'Alice' } }],
    });
    renderSearchPage('q=playlist');

    expect(await screen.findByText('My Playlist')).toBeInTheDocument();
  });

  it('renders matching live streams', async () => {
    mockSearchApi({ live: [makeStream({ title: 'Live coding session' })] });
    renderSearchPage('q=live');

    expect(await screen.findByText('Live coding session')).toBeInTheDocument();
  });

  it('shows a no-results state when nothing matches', async () => {
    mockSearchApi();
    renderSearchPage('q=nothing');

    expect(await screen.findByText('No results')).toBeInTheDocument();
  });

  it('shows an error state with a retry link on failure', async () => {
    apiGet.mockRejectedValue(new Error('network down'));
    renderSearchPage('q=forge');

    expect(await screen.findByText('Search failed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retry' })).toHaveAttribute(
      'href',
      expect.stringContaining('/search?q=forge'),
    );
  });

  it('navigates with the type param when a result-type tab is clicked', async () => {
    mockSearchApi({ videos: [makeVideo()] });
    const user = userEvent.setup();
    renderSearchPage('q=forge');

    await screen.findByTestId('feed-card-v1');
    await user.click(screen.getByRole('tab', { name: 'Channels' }));

    expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('type=channel'));
  });

  it('hides duration/sort filters for the Channels tab but shows them for All/Videos', async () => {
    mockSearchApi();
    const { unmount } = renderSearchPage('q=forge&type=channel');
    await screen.findByText('No results');
    expect(screen.queryByRole('radiogroup', { name: 'Duration' })).not.toBeInTheDocument();
    unmount();

    mockSearchApi({ videos: [makeVideo()] });
    renderSearchPage('q=forge');
    await screen.findByTestId('feed-card-v1');
    expect(screen.getByRole('radiogroup', { name: 'Duration' })).toBeInTheDocument();
  });

  it('hides the watch-history filter for guests', async () => {
    mockSearchApi({ videos: [makeVideo()] });
    renderSearchPage('q=forge', { guest: true });

    await screen.findByTestId('feed-card-v1');
    expect(screen.queryByRole('radiogroup', { name: 'Watch history' })).not.toBeInTheDocument();
  });

  it('submits the search form with the trimmed input', async () => {
    mockSearchApi();
    const user = userEvent.setup();
    renderSearchPage('');

    const input = screen.getByPlaceholderText('Search videos, channels, playlists…');
    await user.type(input, '  forge  ');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(routerPush).toHaveBeenCalledWith('/search?q=forge');
  });

  it('skips the catalog search entirely when filtering to Live only', async () => {
    mockSearchApi({ live: [makeStream({ title: 'Live coding session' })] });
    renderSearchPage('q=live&live=yes');

    await screen.findByText('Live coding session');
    expect(apiGet).not.toHaveBeenCalledWith('/search', expect.anything());
  });
});
