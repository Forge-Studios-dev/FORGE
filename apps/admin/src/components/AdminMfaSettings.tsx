'use client';

import { useEffect, useId, useState } from 'react';
import { Button, Input } from '@forge/design-system';
import { api } from '@/lib/api';

type Step = 'loading' | 'off' | 'enrolling' | 'backup-codes' | 'on' | 'disabling';

function errorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
}

/**
 * Admin TOTP enrollment — required for ADMIN API routes (`RolesGuard` hard-gate).
 * Same endpoints as the consumer web app (`/auth/mfa/*`).
 */
export function AdminMfaSettings() {
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
      setError(errorMessage(err, 'Could not start enrollment. Try again.'));
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('forge-admin-mfa', { detail: { enabled: true } }));
      }
    } catch (err) {
      setError(errorMessage(err, 'Invalid code. Try again.'));
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
      setMessage('Two-factor authentication is now off. Admin API routes will reject until MFA is re-enabled.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('forge-admin-mfa', { detail: { enabled: false } }));
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not disable — check your password.'));
    } finally {
      setPending(false);
    }
  };

  if (step === 'loading') {
    return <p className="text-sm text-on-surface-variant">Loading MFA status…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-on-surface-variant">
        Platform admin API routes require MFA. Enable an authenticator app before using moderation
        tools.
      </p>

      {step === 'off' && (
        <Button type="button" disabled={pending} onClick={() => void startEnrollment()}>
          {pending ? 'Starting…' : 'Enable two-factor authentication'}
        </Button>
      )}

      {step === 'enrolling' && (
        <form className="space-y-3" onSubmit={(e) => void confirmEnrollment(e)}>
          <p className="text-sm text-on-surface-variant">
            Add this setup key in your authenticator app, then enter the 6-digit code.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor={`${id}-secret`}>
              Setup key
            </label>
            <code
              id={`${id}-secret`}
              className="block break-all rounded-lg bg-surface-container px-3 py-2 text-sm"
            >
              {secret}
            </code>
          </div>
          <details className="text-sm text-on-surface-variant">
            <summary className="cursor-pointer select-none">otpauth:// URI</summary>
            <code className="mt-2 block break-all text-xs">{otpauthUri}</code>
          </details>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor={`${id}-code`}>
              Verification code
            </label>
            <Input
              id={`${id}-code`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              required
            />
          </div>
          <Button type="submit" disabled={pending || code.trim().length < 6}>
            {pending ? 'Confirming…' : 'Confirm and enable'}
          </Button>
        </form>
      )}

      {step === 'backup-codes' && (
        <div className="space-y-3">
          <p className="text-sm text-on-surface">
            MFA is on. Save these backup codes — each works once if you lose your authenticator.
          </p>
          <ul className="grid gap-1 font-mono text-sm sm:grid-cols-2">
            {backupCodes.map((c) => (
              <li key={c} className="rounded bg-surface-container px-2 py-1">
                {c}
              </li>
            ))}
          </ul>
          <Button type="button" variant="secondary" onClick={() => setStep('on')}>
            Done
          </Button>
        </div>
      )}

      {step === 'on' && (
        <>
          <p className="text-sm text-secondary">Two-factor authentication is enabled.</p>
          <Button type="button" variant="secondary" onClick={() => setStep('disabling')}>
            Disable MFA…
          </Button>
        </>
      )}

      {step === 'disabling' && (
        <form className="space-y-3" onSubmit={(e) => void disable(e)}>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor={`${id}-pw`}>
              Current password
            </label>
            <Input
              id={`${id}-pw`}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Disabling…' : 'Disable MFA'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep('on')}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {message ? (
        <p className="text-sm text-secondary" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
