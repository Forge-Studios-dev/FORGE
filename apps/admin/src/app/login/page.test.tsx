import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminLoginPage from './page';

const push = vi.fn();
const persistAdminSession = vi.fn();
const apiPost = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mocked by relative path, not the `@/` alias: vi.mock's specifier matching
// runs before vite-tsconfig-paths resolves the alias, so an aliased specifier
// here never matches page.tsx's `@/lib/*` imports at the resolved module id
// and silently falls through to the real module.
vi.mock('../../lib/api', () => ({
  api: { post: (...args: unknown[]) => apiPost(...args) },
}));

vi.mock('../../lib/auth-storage', () => ({
  persistAdminSession: (...args: unknown[]) => persistAdminSession(...args),
}));

vi.mock('../../lib/app-check', () => ({
  getAppCheckToken: vi.fn().mockResolvedValue(null),
}));

// The design-system Input doesn't associate its sibling <label> via htmlFor/id
// (LOW-09), so tests query by input type rather than accessible label.
function getFields(container: HTMLElement) {
  const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
  const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
  return { emailInput, passwordInput };
}

describe('AdminLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a non-admin login response and redirects to /unauthorized without persisting a session', async () => {
    apiPost.mockResolvedValue({ data: { data: { accessToken: 'x', refreshToken: 'y', user: { role: 'user' } } } });
    const user = userEvent.setup();
    const { container } = render(<AdminLoginPage />);
    const { emailInput, passwordInput } = getFields(container);

    await user.type(emailInput, 'user@forge.local');
    await user.type(passwordInput, 'ForgeDemo123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/unauthorized'));
    expect(persistAdminSession).not.toHaveBeenCalled();
  });

  it('persists the session and redirects to /dashboard for an actual admin', async () => {
    apiPost.mockResolvedValue({
      data: { data: { accessToken: 'admin-token', refreshToken: 'r', user: { role: 'admin' } } },
    });
    const user = userEvent.setup();
    const { container } = render(<AdminLoginPage />);
    const { emailInput, passwordInput } = getFields(container);

    await user.type(emailInput, 'admin@forge.local');
    await user.type(passwordInput, 'ForgeAdmin123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(persistAdminSession).toHaveBeenCalledWith('admin-token'));
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('prompts for MFA when login returns mfaRequired, then verifies', async () => {
    apiPost
      .mockResolvedValueOnce({
        data: { data: { mfaRequired: true, challengeToken: 'chal-admin' } },
      })
      .mockResolvedValueOnce({
        data: { data: { accessToken: 'mfa-token', refreshToken: 'r', user: { role: 'admin' } } },
      });
    const user = userEvent.setup();
    const { container } = render(<AdminLoginPage />);
    const { emailInput, passwordInput } = getFields(container);

    await user.type(emailInput, 'admin@forge.local');
    await user.type(passwordInput, 'ForgeAdmin123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/two-factor verification/i)).toBeInTheDocument();
    const codeInput = screen.getByLabelText(/authentication code/i);
    await user.type(codeInput, '123456');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenLastCalledWith('/auth/mfa/login-verify', {
        challengeToken: 'chal-admin',
        code: '123456',
      }),
    );
    expect(persistAdminSession).toHaveBeenCalledWith('mfa-token');
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('rejects an obviously invalid email client-side without calling the API', async () => {
    const user = userEvent.setup();
    const { container } = render(<AdminLoginPage />);
    const { emailInput, passwordInput } = getFields(container);

    await user.type(emailInput, 'not-an-email');
    await user.type(passwordInput, 'longenoughpassword');
    // fireEvent.submit bypasses the browser's native constraint validation
    // (type="email" + required), which would otherwise block the submit
    // event before handleSubmit's own validation ever runs — a real user
    // clicking "Sign in" with this value never reaches our custom message
    // either, but that's the browser's native tooltip doing its job; this
    // proves the fallback JS validation behind it also works correctly.
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('rejects a too-short password client-side without calling the API', async () => {
    const user = userEvent.setup();
    const { container } = render(<AdminLoginPage />);
    const { emailInput, passwordInput } = getFields(container);

    await user.type(emailInput, 'admin@forge.local');
    await user.type(passwordInput, 'short');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('shows a generic error on API failure without leaking response detail', async () => {
    apiPost.mockRejectedValue(new Error('network error'));
    const user = userEvent.setup();
    const { container } = render(<AdminLoginPage />);
    const { emailInput, passwordInput } = getFields(container);

    await user.type(emailInput, 'admin@forge.local');
    await user.type(passwordInput, 'ForgeAdmin123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
