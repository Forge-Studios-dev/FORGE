'use client';

import { useState } from 'react';
import { Dialog } from '@forge/design-system/client';

/**
 * Step-up auth (MED-13) confirmation for granting the admin role — the
 * calling admin must re-enter their own password. Shared between the
 * single-user detail page and the users list's bulk "Set role…" action,
 * since the backend requires this password on both paths.
 */
export function GrantAdminDialog({
  open,
  title,
  loading,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState('');

  return (
    <Dialog open={open} onClose={onCancel} labelledBy="grant-admin-title" size="sm" role="alertdialog">
      <h2 id="grant-admin-title" className="font-display-forge mb-2 text-lg font-semibold">
        {title}
      </h2>
      <p className="mb-4 text-sm text-on-surface-variant">
        This grants full platform privileges. Re-enter your password to confirm.
      </p>
      <label className="block">
        <span className="font-label-caps text-outline">Your password</span>
        <input
          type="password"
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setPassword('');
            onCancel();
          }}
          disabled={loading}
          className="rounded-full border border-outline-variant px-4 py-2 text-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm(password);
            setPassword('');
          }}
          disabled={loading || !password}
          className="rounded-full border border-error/40 px-4 py-2 text-sm text-error hover:bg-error/10 disabled:opacity-50"
        >
          {loading ? 'Granting…' : 'Grant admin'}
        </button>
      </div>
    </Dialog>
  );
}
