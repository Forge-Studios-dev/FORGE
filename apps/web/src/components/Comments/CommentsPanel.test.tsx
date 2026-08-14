import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommentsPanel } from './CommentsPanel';
import type { Comment } from '@/types';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();
const apiDelete = vi.fn();

// Mocked by relative path — vi.mock's specifier matching runs before
// vite-tsconfig-paths resolves the `@/` alias, so an aliased specifier here
// would silently miss CommentsPanel.tsx's `@/lib/*` imports.
vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    patch: (...args: unknown[]) => apiPatch(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}));

let currentUser: { id: string; displayName?: string; avatarUrl?: string | null } | null = {
  id: 'me',
  displayName: 'Me',
};
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: currentUser }),
}));

vi.mock('../../lib/auth-storage', () => ({
  getAccessToken: () => null,
}));

vi.mock('../../lib/socket', () => ({
  getSocket: () => null,
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
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
  useSearchParams: () => new URLSearchParams(),
}));

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    userId: 'other',
    user: { id: 'other', username: 'other-user', displayName: 'Other User' } as Comment['user'],
    videoId: 'v1',
    content: 'Great video!',
    likeCount: 0,
    replyCount: 0,
    isPinned: false,
    creatorHearted: false,
    viewerLiked: false,
    viewerDisliked: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  } as Comment;
}

// api.get() stands in for axios's AxiosResponse, so this needs the same
// three levels the real stack produces: AxiosResponse.data (the JSON body)
// is TransformInterceptor's { success, data } envelope, and .data inside
// that is the endpoint's own { data: Comment[], meta } shape.
function commentsResponse(data: Comment[], meta: Partial<{ cursor: string | null; hasMore: boolean; total: number }> = {}) {
  return { data: { data: { data, meta: { cursor: null, hasMore: false, total: data.length, ...meta } } } };
}

function renderPanel(props: Partial<React.ComponentProps<typeof CommentsPanel>> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CommentsPanel videoId="v1" {...props} />
    </QueryClientProvider>,
  );
}

describe('CommentsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { id: 'me', displayName: 'Me' };
    apiGet.mockResolvedValue(commentsResponse([]));
  });

  it('renders comments returned from the API', async () => {
    apiGet.mockResolvedValue(commentsResponse([makeComment({ content: 'Nice work' })]));
    renderPanel();

    expect(await screen.findByText('Nice work')).toBeInTheDocument();
    expect(screen.getByText('Other User')).toBeInTheDocument();
  });

  it('shows an empty state when there are no comments', async () => {
    apiGet.mockResolvedValue(commentsResponse([]));
    renderPanel();

    expect(await screen.findByText(/no comments yet/i)).toBeInTheDocument();
  });

  it('posts a new top-level comment and clears the composer on success', async () => {
    apiGet.mockResolvedValue(commentsResponse([]));
    apiPost.mockResolvedValue({ data: { data: makeComment({ id: 'new' }) } });
    const user = userEvent.setup();
    renderPanel();

    const textarea = await screen.findByPlaceholderText('Add to the discussion…');
    await user.type(textarea, 'My new comment');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/videos/v1/comments', { content: 'My new comment' });
    });
    await waitFor(() => expect(textarea).toHaveValue(''));
  });

  it('routes guest interaction through onGuestInteract instead of posting', async () => {
    currentUser = null;
    apiGet.mockResolvedValue(commentsResponse([]));
    const onGuestInteract = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onGuestInteract });

    const textarea = await screen.findByPlaceholderText('Sign in to comment');
    await user.click(textarea);

    expect(onGuestInteract).toHaveBeenCalled();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('refetches with the newest sort param when the Newest tab is clicked', async () => {
    apiGet.mockResolvedValue(commentsResponse([makeComment()]));
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText('Great video!');
    await user.click(screen.getByRole('tab', { name: 'Newest' }));

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        expect.stringContaining('/videos/v1/comments?limit=20&sort=newest'),
      );
    });
  });

  it('applies the like optimistically before the request settles', async () => {
    apiGet.mockResolvedValue(commentsResponse([makeComment({ likeCount: 2 })]));
    // Never resolves — keeps the mutation pending so the optimistic frame
    // is stable and observable instead of collapsing into the same React
    // commit as a same-tick resolve/reject would.
    apiPost.mockImplementation(() => new Promise(() => {}));
    apiDelete.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderPanel();

    const likeButton = await screen.findByRole('button', { name: /like comment, 2 likes/i });
    await user.click(likeButton);

    expect(await screen.findByRole('button', { name: /unlike comment, 3 likes/i })).toBeInTheDocument();
  });

  it('rolls back the like on request failure', async () => {
    apiGet.mockResolvedValue(commentsResponse([makeComment({ likeCount: 2 })]));
    // Whether api.post (like) or api.delete (unlike) ends up firing depends
    // on exact re-render timing relative to onMutate, so both are mocked to
    // reject rather than asserting which one ran.
    apiPost.mockRejectedValue(new Error('network error'));
    apiDelete.mockRejectedValue(new Error('network error'));
    const user = userEvent.setup();
    renderPanel();

    const likeButton = await screen.findByRole('button', { name: /like comment, 2 likes/i });
    await user.click(likeButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /like comment, 2 likes/i })).toBeInTheDocument();
    });
  });

  it('shows Edit/Delete only for the comment author', async () => {
    apiGet.mockResolvedValue(
      commentsResponse([
        makeComment({ id: 'mine', userId: 'me', content: 'My own comment' }),
        makeComment({ id: 'theirs', userId: 'other', content: 'Their comment' }),
      ]),
    );
    renderPanel();

    await screen.findByText('My own comment');
    const mineArticle = screen.getByText('My own comment').closest('article')!;
    const theirsArticle = screen.getByText('Their comment').closest('article')!;

    expect(within(mineArticle).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(mineArticle).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(within(theirsArticle).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('shows Remove/Pin/Heart only when the viewer owns the video', async () => {
    apiGet.mockResolvedValue(commentsResponse([makeComment({ id: 'theirs', userId: 'other' })]));

    const { unmount } = renderPanel({ videoOwnerId: 'me' });
    await screen.findByText('Great video!');
    expect(screen.getByRole('button', { name: 'Remove comment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pin comment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Heart comment' })).toBeInTheDocument();
    unmount();

    apiGet.mockResolvedValue(commentsResponse([makeComment({ id: 'theirs2', userId: 'other' })]));
    renderPanel({ videoOwnerId: 'someone-else' });
    await screen.findByText('Great video!');
    expect(screen.queryByRole('button', { name: 'Remove comment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pin comment' })).not.toBeInTheDocument();
  });

  it('prefills a mention and shows the reply banner when replying', async () => {
    apiGet.mockResolvedValue(
      commentsResponse([makeComment({ user: { id: 'other', username: 'alice', displayName: 'Alice' } as Comment['user'] })]),
    );
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText('Great video!');
    await user.click(screen.getByRole('button', { name: 'Reply' }));

    expect(screen.getByText(/replying to comment/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add to the discussion…')).toHaveValue('@alice ');
  });

  it('deletes a comment after confirming', async () => {
    apiGet.mockResolvedValue(commentsResponse([makeComment({ id: 'mine', userId: 'me' })]));
    apiDelete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText('Great video!');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith('/videos/v1/comments/mine');
    });
  });
});
