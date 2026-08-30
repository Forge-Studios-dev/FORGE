import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StudioVideosPage from './page';
import type { Video } from '@/types';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();
const apiDelete = vi.fn();

// Mocked by relative path — vi.mock's specifier matching runs before
// vite-tsconfig-paths resolves the `@/` alias, so an aliased specifier here
// would silently miss page.tsx's `@/lib/*` imports. Leaving `@/lib/creator-studio`
// and `@/lib/categories` unmocked lets their real `api.get(...)` wrappers run
// against this mock instead of duplicating their querystring-building logic.
vi.mock('../../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    patch: (...args: unknown[]) => apiPatch(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}));

vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({ user: { id: 'me' }, accessToken: 'token', isCreator: true }),
}));

vi.mock('../../../lib/socket', () => ({
  getSocket: () => null,
}));

vi.mock('../../../lib/upload-manager', () => ({
  getActiveUpload: () => null,
  subscribeActiveUpload: () => () => {},
}));

let searchParamsString = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParamsString),
  usePathname: () => '/studio/videos',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function makeVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: 'v1',
    title: 'My video',
    status: 'ready',
    visibility: 'public',
    videoType: 'video',
    viewCount: 10,
    durationSeconds: 125,
    createdAt: new Date('2026-01-01').toISOString(),
    publishedAt: new Date('2026-01-01').toISOString(),
    scheduledPublishAt: null,
    thumbnailUrl: null,
    skillTags: [],
    ...overrides,
  } as Video;
}

function libraryEnvelope(items: Video[], pagination: Partial<{ page: number; limit: number; total: number; hasMore: boolean }> = {}) {
  return {
    data: {
      data: {
        data: items,
        pagination: { page: 1, limit: 30, total: items.length, hasMore: false, ...pagination },
      },
    },
  };
}

function mockLibrary(items: Video[]) {
  apiGet.mockImplementation(async (url: string) => {
    if (url.startsWith('/videos/studio')) return libraryEnvelope(items);
    if (url === '/categories/upload-options') return { data: { data: [] } };
    throw new Error(`Unexpected api.get(${url})`);
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <StudioVideosPage />
    </QueryClientProvider>,
  );
}

describe('StudioVideosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsString = '';
    mockLibrary([makeVideo()]);
    apiPost.mockResolvedValue({ data: {} });
    apiPatch.mockResolvedValue({ data: {} });
    apiDelete.mockResolvedValue({ data: {} });
  });

  it('shows an empty state with no videos', async () => {
    mockLibrary([]);
    renderPage();

    expect(await screen.findByText('No videos yet')).toBeInTheDocument();
  });

  it('shows a search-aware empty state when the query URL has a search term', async () => {
    searchParamsString = 'search=nothing-matches';
    mockLibrary([]);
    renderPage();

    expect(await screen.findByText('No matching videos')).toBeInTheDocument();
    expect(await screen.findByText(/nothing-matches/)).toBeInTheDocument();
  });

  it('shows an error state when the library fails to load', async () => {
    apiGet.mockRejectedValue(new Error('network down'));
    renderPage();

    expect(await screen.findByText('Failed to load videos.')).toBeInTheDocument();
  });

  it('renders a video row with status, visibility, and views', async () => {
    mockLibrary([makeVideo({ title: 'Intro to FORGE', viewCount: 4200 })]);
    renderPage();

    const table = await screen.findByRole('table');
    await within(table).findByText('Intro to FORGE');
    expect(within(table).getByText('Published')).toBeInTheDocument();
    expect(within(table).getByText(/4\.2K/)).toBeInTheDocument();
  });

  it('shows Publish now / Cancel schedule for a future-scheduled video', async () => {
    mockLibrary([
      makeVideo({
        id: 'sched1',
        visibility: 'private',
        status: 'ready',
        scheduledPublishAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ]);
    const user = userEvent.setup();
    renderPage();

    const table = await screen.findByRole('table');
    await within(table).findByText('My video');
    await user.click(within(table).getByRole('button', { name: 'Publish now' }));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/videos/sched1', { scheduledPublishAt: null }),
    );
  });

  it('cancels a schedule, reverting the video to private', async () => {
    mockLibrary([
      makeVideo({
        id: 'sched2',
        scheduledPublishAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ]);
    const user = userEvent.setup();
    renderPage();

    const table = await screen.findByRole('table');
    await within(table).findByText('My video');
    await user.click(within(table).getByRole('button', { name: 'Cancel schedule' }));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/videos/sched2', {
        scheduledPublishAt: null,
        visibility: 'private',
      }),
    );
  });

  it('cancels an in-progress upload after confirming', async () => {
    mockLibrary([makeVideo({ id: 'up1', status: 'uploading' })]);
    const user = userEvent.setup();
    renderPage();

    const table = await screen.findByRole('table');
    await within(table).findByText('My video');
    await user.click(within(table).getByRole('button', { name: 'Cancel' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel upload' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/videos/up1/cancel-upload'));
  });

  it('deletes a video after confirming', async () => {
    mockLibrary([makeVideo({ id: 'del1' })]);
    const user = userEvent.setup();
    renderPage();

    const table = await screen.findByRole('table');
    await within(table).findByText('My video');
    await user.click(within(table).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/videos/del1'));
  });

  it('changes a video visibility from the row select', async () => {
    mockLibrary([makeVideo({ id: 'vis1', visibility: 'public' })]);
    const user = userEvent.setup();
    renderPage();

    const table = await screen.findByRole('table');
    await within(table).findByText('My video');
    await user.selectOptions(
      within(table).getByRole('combobox', { name: 'Visibility for My video' }),
      'private',
    );

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/videos/vis1', { visibility: 'private' }),
    );
  });

  it('copies the public link to the clipboard', async () => {
    mockLibrary([makeVideo({ id: 'copy1', status: 'ready' })]);
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    const table = await screen.findByRole('table');
    await within(table).findByText('My video');
    await user.click(within(table).getByRole('button', { name: 'Copy link' }));

    expect(await screen.findByText('Link copied')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/watch/copy1'));
  });

  it('shows the in-progress banner and clears stuck uploads', async () => {
    mockLibrary([makeVideo({ id: 'stuck1', status: 'processing' })]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('1 video in progress')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear stuck uploads' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/videos/release-stuck-uploads'));
  });

  it('re-queries the server when the status filter changes', async () => {
    renderPage();
    await screen.findByRole('table');
    const user = userEvent.setup();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'failed');

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(expect.stringContaining('status=failed')),
    );
  });

  it('loads the next page on Load more', async () => {
    mockLibrary([]);
    apiGet.mockImplementation(async (url: string) => {
      if (!url.startsWith('/videos/studio')) return { data: { data: [] } };
      const page = new URLSearchParams(url.split('?')[1] ?? '').get('page') ?? '1';
      if (page === '1') {
        return libraryEnvelope([makeVideo({ id: 'p1', title: 'Page one video' })], {
          page: 1,
          hasMore: true,
        });
      }
      return libraryEnvelope([makeVideo({ id: 'p2', title: 'Page two video' })], {
        page: 2,
        hasMore: false,
      });
    });
    const user = userEvent.setup();
    renderPage();

    const table = await screen.findByRole('table');
    await within(table).findByText('Page one video');
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    await within(table).findByText('Page two video');
    expect(within(table).getByText('Page one video')).toBeInTheDocument();
  });
});
