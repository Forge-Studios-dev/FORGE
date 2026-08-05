'use client';

import { FormEvent, useId, useState } from 'react';
import { Button, Input } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';

/** In-app change password + email reset fallback for the signed-in account. */
export function PasswordResetSettings() {
  const { user } = useAuth();
  const id = useId();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [emailPending, setEmailPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!user?.email) return null;

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setPending(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Password updated. Other devices were signed out.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not change password. Try again.'));
    } finally {
      setPending(false);
    }
  };

  const sendEmailReset = async () => {
    setEmailPending(true);
    setMessage('');
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: user.email });
      setMessage('If that email is registered, a reset link is on its way. Check your inbox.');
    } catch {
      setError('Could not start password reset. Try again later.');
    } finally {
      setEmailPending(false);
    }
  };

  return (
    <div id="security" className="glass-panel mt-6 space-y-4 rounded-2xl p-6">
      <h2 className="font-display-forge text-lg font-semibold">Security</h2>
      <p className="text-sm text-on-surface-variant">
        Change your password for <span className="text-on-surface">{user.email}</span>. Other
        sessions will be signed out.
      </p>

      <form className="space-y-3" onSubmit={(e) => void changePassword(e)}>
        <div>
          <label htmlFor={`${id}-current`} className="mb-1 block text-sm font-medium text-on-surface">
            Current password
          </label>
          <Input
            id={`${id}-current`}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor={`${id}-new`} className="mb-1 block text-sm font-medium text-on-surface">
            New password
          </label>
          <Input
            id={`${id}-new`}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div>
          <label htmlFor={`${id}-confirm`} className="mb-1 block text-sm font-medium text-on-surface">
            Confirm new password
          </label>
          <Input
            id={`${id}-confirm`}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <Button type="submit" disabled={pending || emailPending}>
          {pending ? 'Updating…' : 'Update password'}
        </Button>
      </form>

      <div className="border-t border-outline-variant/20 pt-4">
        <p className="mb-3 text-sm text-on-surface-variant">
          Prefer a reset link, or signed in with Google? Email a one-time link instead.
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || emailPending}
          onClick={() => void sendEmailReset()}
        >
          {emailPending ? 'Sending…' : 'Email password reset link'}
        </Button>
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}
      {message ? <p className="text-sm text-secondary">{message}</p> : null}
    </div>
  );
}
