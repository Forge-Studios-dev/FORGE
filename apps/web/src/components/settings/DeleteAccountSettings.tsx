'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@forge/design-system';
import { api } from '@/lib/api';
import { clearAuthSession } from '@/lib/auth-storage';
import { getApiErrorMessage } from '@/lib/api-message';

type Mode = 'closed' | 'password' | 'email-sent';

/** Self-service account deletion — password confirm, or an emailed link for Google-only accounts with no usable password. */
export function DeleteAccountSettings() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('closed');
  const [currentPassword, setCurrentPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const deleteWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await api.delete('/users/me', { data: { currentPassword } });
      clearAuthSession();
      router.push('/');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete account — check your password.'));
    } finally {
      setPending(false);
    }
  };

  const requestEmailLink = async () => {
    setError('');
    setPending(true);
    try {
      await api.post('/auth/account-deletion/request');
      setMode('email-sent');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send confirmation email. Try again.'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="glass-panel mt-6 space-y-4 rounded-2xl border border-error/30 p-6">
      <h2 className="font-display-forge text-lg font-semibold text-error">Delete account</h2>
      <p className="text-sm text-on-surface-variant">
        Permanently deletes your account, hides your videos, and ends any active streams. This
        cannot be undone.
      </p>

      {mode === 'closed' && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setMode('password')}>
            Delete with password
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => void requestEmailLink()}
          >
            Signed in with Google? Email me a confirmation link
          </Button>
        </div>
      )}

      {mode === 'password' && (
        <form className="space-y-3" onSubmit={(e) => void deleteWithPassword(e)}>
          <div>
            <label
              htmlFor="delete-account-password"
              className="mb-1 block text-sm font-medium text-on-surface"
            >
              Current password
            </label>
            <Input
              id="delete-account-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={pending}
              className="bg-error text-on-error hover:bg-error/90"
            >
              {pending ? 'Deleting…' : 'Permanently delete my account'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setMode('closed')}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {mode === 'email-sent' && (
        <p className="text-sm text-secondary">
          If that address is on your account, a confirmation link is on its way — it expires in
          15 minutes.
        </p>
      )}

      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}
