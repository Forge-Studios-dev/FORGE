import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const persistAuthSession = vi.fn();
const apiPost = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// All of these are mocked by relative path, not the `@/` alias: vi.mock's
// specifier matching runs before vite-tsconfig-paths resolves the alias, so
// an aliased specifier here never matches LoginForm.tsx's `@/lib/*` imports
// at the resolved module id and silently falls through to the real module.
vi.mock('../../../lib/api', () => ({
  api: { post: (...args: unknown[]) => apiPost(...args) },
}));

vi.mock('../../../lib/auth-storage', () => ({
  persistAuthSession: (...args: unknown[]) => persistAuthSession(...args),
}));

vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({ refresh }),
}));

vi.mock('../../../lib/analytics', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../lib/app-check', () => ({
  getAppCheckToken: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../lib/platform-config', () => ({
  loadPlatformConfig: vi.fn().mockResolvedValue(null),
  isGoogleOAuthEnabled: () => false,
}));

function renderForm() {
  return render(
    <LoginForm nextPath="/" resetOk={false} adminBlocked={false} showGoogleInitially={false} />,
  );
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks a platform-admin login response and never persists the session (defense-in-depth alongside the server-side block)', async () => {
    apiPost.mockResolvedValue({
      data: { data: { user: { role: 'admin' }, accessToken: 'x', refreshToken: 'y', sessionId: 's' } },
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Email'), 'admin@forge.local');
    await user.type(screen.getByLabelText('Password'), 'ForgeAdmin123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText(/platform administrator accounts cannot sign in here/i),
    ).toBeInTheDocument();
    expect(persistAuthSession).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('persists the session and redirects an approved creator to the return path', async () => {
    apiPost.mockResolvedValue({
      data: {
        data: {
          user: { role: 'creator', creatorStatus: 'approved' },
          accessToken: 'token',
          refreshToken: 'refresh',
          sessionId: 'sess-1',
        },
      },
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Email'), 'creator@forge.local');
    await user.type(screen.getByLabelText('Password'), 'ForgeDemo123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(persistAuthSession).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/');
  });

  it('routes a pending creator to the waiting-approval screen instead of the return path', async () => {
    apiPost.mockResolvedValue({
      data: {
        data: {
          user: { role: 'creator', creatorStatus: 'pending' },
          accessToken: 'token',
          refreshToken: 'refresh',
          sessionId: 'sess-1',
        },
      },
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Email'), 'creator@forge.local');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/waiting-approval'));
  });

  it('surfaces the account-locked error message from the API', async () => {
    apiPost.mockRejectedValue({
      response: { data: { code: 'ACCOUNT_LOCKED', message: 'Too many attempts. Try again in 10 minutes.' } },
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Email'), 'user@forge.local');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
    expect(persistAuthSession).not.toHaveBeenCalled();
  });

  it('redirects to email verification when the API reports an unverified account', async () => {
    apiPost.mockRejectedValue({ response: { data: { code: 'EMAIL_NOT_VERIFIED' } } });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Email'), 'user@forge.local');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/verify-email'));
  });
});
