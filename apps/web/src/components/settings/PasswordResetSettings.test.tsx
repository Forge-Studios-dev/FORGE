import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordResetSettings } from './PasswordResetSettings';

const apiPost = vi.fn();

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'me', email: 'me@example.com' },
  }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    post: (...args: unknown[]) => apiPost(...args),
  },
}));

vi.mock('../../lib/api-message', () => ({
  getApiErrorMessage: () => 'Could not change password. Try again.',
}));

describe('PasswordResetSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiPost.mockResolvedValue({});
  });

  it('rejects mismatched new passwords without calling the API', async () => {
    const user = userEvent.setup();
    render(<PasswordResetSettings />);
    await user.type(screen.getByLabelText(/current password/i), 'oldpass12');
    await user.type(screen.getByLabelText(/^new password$/i), 'newpass12');
    await user.type(screen.getByLabelText(/confirm new password/i), 'different');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('posts change-password on success', async () => {
    const user = userEvent.setup();
    render(<PasswordResetSettings />);
    await user.type(screen.getByLabelText(/current password/i), 'oldpass12');
    await user.type(screen.getByLabelText(/^new password$/i), 'newpass12');
    await user.type(screen.getByLabelText(/confirm new password/i), 'newpass12');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/auth/change-password', {
        currentPassword: 'oldpass12',
        newPassword: 'newpass12',
      });
    });
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
  });
});
