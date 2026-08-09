import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StudioVideoDetailEditorPage from './page';
import type { Video } from '@/types';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();
const apiPut = vi.fn();

// Mocked by relative path — vi.mock's specifier matching runs before
// vite-tsconfig-paths resolves the `@/` alias, so an aliased specifier here
// would silently miss page.tsx's `@/lib/*` imports. `@/lib/categories` is
// left unmocked so its real `api.get(...)` wrappers run against this mock.
vi.mock('../../../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    patch: (...args: unknown[]) => apiPatch(...args),
    put: (...args: unknown[]) => apiPut(...args),
  },
}));

let currentUser: { id: string } | null = { id: 'creator-1' };
let isCreator = true;
vi.mock('../../../../lib/auth', () => ({
  useAuth: () => ({ user: currentUser, isCreator }),
}));

const routerPush = vi.fn();
let videoId = 'v1';
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: videoId }),
  useRouter: () => ({ push: routerPush }),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('../../../../components/playlists/SaveToPlaylistModal', () => ({
  SaveToPlaylistModal: () => null,
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
    viewCount: 100,
    likeCount: 10,
    commentCount: 2,
    durationSeconds: 300,
    scheduledPublishAt: null,
    categoryId: '',
    skillTags: [],
    thumbnailUrl: null,
    captionTracks: [],
    captionUrl: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  } as Video;
}

function mockVideoFetch(video: Video | null, opts: { error?: boolean } = {}) {
  apiGet.mockImplementation(async (url: string) => {
    if (opts.error) throw new Error('not found');
    if (url === `/videos/${video?.id ?? videoId}`) return { data: { data: video } };
    if (url.startsWith('/playlists/me/containing/')) return { data: { data: { playlistIds: [] } } };
    if (url === '/categories/upload-options') return { data: { data: [] } };
    if (url.startsWith('/categories/')) return { data: [] };
    throw new Error(`Unexpected api.get(${url})`);
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <StudioVideoDetailEditorPage />
    </QueryClientProvider>,
  );
}

describe('StudioVideoDetailEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { id: 'creator-1' };
    isCreator = true;
    videoId = 'v1';
    mockVideoFetch(makeVideo());
    apiPatch.mockResolvedValue({ data: {} });
    apiPost.mockResolvedValue({ data: {} });
    apiPut.mockResolvedValue({ data: {} });
  });

  it('requires creator access', () => {
    isCreator = false;
    renderPage();

    expect(screen.getByText('Creator access required.')).toBeInTheDocument();
  });

  it('shows a loading state before the video resolves', () => {
    apiGet.mockImplementation(() => new Promise(() => {}));
    renderPage();

    expect(screen.getByText('Loading video editor…')).toBeInTheDocument();
  });

  it("shows an error state when the video can't be loaded", async () => {
    mockVideoFetch(null, { error: true });
    renderPage();

    expect(await screen.findByText('This video could not be loaded.')).toBeInTheDocument();
  });

  it("shows an error state when the viewer doesn't own the video", async () => {
    currentUser = { id: 'someone-else' };
    renderPage();

    expect(await screen.findByText('This video could not be loaded.')).toBeInTheDocument();
  });

  it('renders the loaded video into the form and sidebar stats', async () => {
    mockVideoFetch(makeVideo({ title: 'Intro to FORGE', viewCount: 4200, likeCount: 300, commentCount: 12 }));
    renderPage();

    expect(await screen.findByDisplayValue('Intro to FORGE')).toBeInTheDocument();
    expect(screen.getByText('4.2K views · 300 likes · 12 comments')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
  });

  it('saves title and visibility changes', async () => {
    const user = userEvent.setup();
    renderPage();

    const titleInput = await screen.findByDisplayValue('My video');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated title');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Visibility' }), 'private');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith(
        '/videos/v1',
        expect.objectContaining({ title: 'Updated title', visibility: 'private' }),
      ),
    );
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('disables Save when the title is cleared', async () => {
    const user = userEvent.setup();
    renderPage();

    const titleInput = await screen.findByDisplayValue('My video');
    await user.clear(titleInput);

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('publishes a scheduled video immediately', async () => {
    mockVideoFetch(
      makeVideo({ scheduledPublishAt: new Date(Date.now() + 86_400_000).toISOString(), visibility: 'private' }),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue('My video');
    await user.click(screen.getByRole('button', { name: 'Publish now' }));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith(
        '/videos/v1',
        expect.objectContaining({ scheduledPublishAt: null }),
      ),
    );
  });

  it('cancels a schedule, reverting to private', async () => {
    mockVideoFetch(makeVideo({ scheduledPublishAt: new Date(Date.now() + 86_400_000).toISOString() }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue('My video');
    await user.click(screen.getByRole('button', { name: 'Cancel schedule' }));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/videos/v1', {
        scheduledPublishAt: null,
        visibility: 'private',
      }),
    );
  });

  it('retries transcoding for a failed video', async () => {
    mockVideoFetch(makeVideo({ status: 'failed', failureReason: 'Codec not supported' }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue('My video');
    expect(screen.getByText('Codec not supported')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry transcode' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/videos/v1/retry-transcode'));
  });

  it('rejects a non-VTT caption file without calling the API', async () => {
    mockVideoFetch(makeVideo({ status: 'ready' }));
    renderPage();

    await screen.findByDisplayValue('My video');
    // userEvent.upload enforces the input's `accept` attribute and would
    // refuse to attach a mismatched file at all — this validation exists for
    // paths that bypass that (e.g. drag-and-drop), so fire the change event
    // directly to simulate one reaching the handler.
    const input = screen.getByLabelText(/Upload en.vtt/i, { selector: 'input' });
    const badFile = new File(['not a caption'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [badFile] } });

    expect(await screen.findByText('Please choose a .vtt WebVTT file.')).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('uploads a caption file end-to-end', async () => {
    mockVideoFetch(makeVideo({ status: 'ready' }));
    apiPost.mockImplementation(async (url: string) => {
      if (url === '/videos/v1/caption/presigned-url') {
        return { data: { data: { uploadUrl: 'https://s3.example/upload', publicUrl: 'https://cdn.example/en.vtt' } } };
      }
      throw new Error(`Unexpected api.post(${url})`);
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue('My video');
    const input = screen.getByLabelText(/Upload en.vtt/i, { selector: 'input' });
    const file = new File(['WEBVTT'], 'captions.vtt', { type: 'text/vtt' });
    await user.upload(input, file);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('https://s3.example/upload', expect.objectContaining({ method: 'PUT' })));
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/videos/v1/caption', {
        captionUrl: 'https://cdn.example/en.vtt',
        language: 'en',
      }),
    );
    expect(await screen.findByText('Captions uploaded (en).')).toBeInTheDocument();
  });

  it('removes an existing caption track', async () => {
    mockVideoFetch(
      makeVideo({
        status: 'ready',
        captionTracks: [{ language: 'en', label: 'English', url: 'https://cdn.example/en.vtt' }],
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue('My video');
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/videos/v1/caption', { captionUrl: null, language: 'en' }),
    );
  });

  it('clears a custom thumbnail', async () => {
    mockVideoFetch(makeVideo({ thumbnailUrl: 'https://cdn.example/thumb.jpg' }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue('My video');
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/videos/v1/thumbnail', { thumbnailUrl: null }),
    );
  });

  it('shows the playlist membership count', async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (url === '/videos/v1') return { data: { data: makeVideo() } };
      if (url === '/playlists/me/containing/v1') return { data: { data: { playlistIds: ['p1', 'p2'] } } };
      if (url === '/categories/upload-options') return { data: { data: [] } };
      throw new Error(`Unexpected api.get(${url})`);
    });
    renderPage();

    expect(await screen.findByText('In 2 playlists')).toBeInTheDocument();
  });
});
