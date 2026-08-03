'use client';

import { useState } from 'react';
import { Button } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** Emails a reset link (same as forgot-password) for the signed-in account. */
export function PasswordResetSettings() {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  if (!user?.email) return null;

  const send = async () => {
    setPending(true);
    setMessage('');
    try {
      await api.post('/auth/forgot-password', { email: user.email });
      setMessage('If that email is registered, a reset link is on its way. Check your inbox.');
    } catch {
      setMessage('Could not start password reset. Try again later.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div id="security" className="glass-panel mt-6 space-y-3 rounded-2xl p-6">
      <h2 className="font-display-forge text-lg font-semibold">Security</h2>
      <p className="text-sm text-on-surface-variant">
        Change your password by emailing a reset link to <span className="text-on-surface">{user.email}</span>.
      </p>
      <Button type="button" variant="secondary" disabled={pending} onClick={() => void send()}>
        {pending ? 'Sending…' : 'Email password reset link'}
      </Button>
      {message ? <p className="text-sm text-secondary">{message}</p> : null}
    </div>
  );
}
