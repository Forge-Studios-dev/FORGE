'use client';

import { useEffect, useId, useState } from 'react';
import { Button, Input } from '@forge/design-system';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-message';

type Step = 'loading' | 'off' | 'enrolling' | 'backup-codes' | 'on' | 'disabling';

/** TOTP two-factor auth: enable (QR-free — copyable setup key), confirm, show backup codes once, or disable. */
export function MfaSettings() {
  const id = useId();
  const [step, setStep] = useState<Step>('loading');
  const [secret, setSecret] = useState('');
  const [otpauthUri, setOtpauthUri] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    void api
      .get<{ data: { enabled: boolean } }>('/auth/mfa/status')
      .then(({ data }) => {
        if (!cancelled) setStep(data.data.enabled ? 'on' : 'off');
      })
      .catch(() => {
        if (!cancelled) setStep('off');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startEnrollment = async () => {
    setError('');
    setPending(true);
    try {
      const { data } = await api.post<{ data: { secret: string; otpauthUri: string } }>(
        '/auth/mfa/enroll',
      );
      setSecret(data.data.secret);
      setOtpauthUri(data.data.otpauthUri);
      setStep('enrolling');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not start enrollment. Try again.'));
    } finally {
      setPending(false);
    }
  };

  const confirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      const { data } = await api.post<{ data: { backupCodes: string[] } }>('/auth/mfa/verify', {
        code: code.trim(),
      });
      setBackupCodes(data.data.backupCodes);
      setCode('');
      setStep('backup-codes');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid code. Try again.'));
    } finally {
      setPending(false);
    }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await api.delete('/auth/mfa', { data: { currentPassword } });
      setCurrentPassword('');
      setStep('off');
      setMessage('Two-factor authentication is now off.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not disable — check your password.'));
    } finally {
      setPending(false);
    }
  };

  if (step === 'loading') return null;

  return (
    <div className="glass-panel mt-6 space-y-4 rounded-2xl p-6">
      <h2 className="font-display-forge text-lg font-semibold">Two-factor authentication</h2>

      {step === 'off' && (
        <>
          <p className="text-sm text-on-surface-variant">
            Add an extra step at sign-in using an authenticator app (Google Authenticator, Authy,
            1Password, ...).
          </p>
          <Button type="button" disabled={pending} onClick={() => void startEnrollment()}>
            {pending ? 'Starting…' : 'Enable two-factor authentication'}
          </Button>
        </>
      )}

      {step === 'enrolling' && (
        <form className="space-y-3" onSubmit={(e) => void confirmEnrollment(e)}>
          <p className="text-sm text-on-surface-variant">
            In your authenticator app, add a new account using this setup key (or paste the URI
            below if your app supports it), then enter the 6-digit code it shows.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-on-surface">Setup key</label>
            <code className="block break-all rounded-lg bg-surface-container px-3 py-2 text-sm">
              {secret}
            </code>
          </div>
          <details className="text-sm text-on-surface-variant">
            <summary className="cursor-pointer select-none">otpauth:// URI</summary>
            <code className="mt-2 block break-all rounded-lg bg-surface-container px-3 py-2 text-xs">
              {otpauthUri}
            </code>
          </details>
          <div>
            <label htmlFor={`${id}-code`} className="mb-1 block text-sm font-medium text-on-surface">
              6-digit code
            </label>
            <Input
              id={`${id}-code`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Confirming…' : 'Confirm'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep('off')}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {step === 'backup-codes' && (
        <div className="space-y-3">
          <p className="text-sm text-on-surface">
            Two-factor authentication is on. Save these one-time backup codes somewhere safe —
            each can be used once if you lose access to your authenticator app. They will not be
            shown again.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-container p-4 font-mono text-sm">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <Button type="button" onClick={() => setStep('on')}>
            Done
          </Button>
        </div>
      )}

      {step === 'on' && (
        <>
          <p className="text-sm text-secondary">Two-factor authentication is on.</p>
          <Button type="button" variant="secondary" onClick={() => setStep('disabling')}>
            Disable
          </Button>
        </>
      )}

      {step === 'disabling' && (
        <form className="space-y-3" onSubmit={(e) => void disable(e)}>
          <div>
            <label
              htmlFor={`${id}-current-password`}
              className="mb-1 block text-sm font-medium text-on-surface"
            >
              Current password
            </label>
            <Input
              id={`${id}-current-password`}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Disabling…' : 'Confirm disable'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep('on')}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {error ? <p className="text-sm text-error">{error}</p> : null}
      {message ? <p className="text-sm text-secondary">{message}</p> : null}
    </div>
  );
}
