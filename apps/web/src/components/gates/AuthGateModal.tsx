'use client';

import Link from 'next/link';
import { Icon } from '@forge/design-system';
import { Dialog } from '@forge/design-system/client';
import { currentReturnPath, loginHrefWithNext, safeReturnPath } from '@/lib/safe-return-path';

export function AuthGateModal({
  open,
  onClose,
  message = 'Sign in to like, comment, and follow creators.',
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
}) {
  const returnPath = typeof window !== 'undefined' ? currentReturnPath() : '/';
  const safe = safeReturnPath(returnPath);
  const loginHref = loginHrefWithNext(safe);
  const signupHref = `/signup?next=${encodeURIComponent(safe)}`;

  return (
    <Dialog open={open} onClose={onClose} labelledBy="auth-gate-title">
      <div className="relative text-center">
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-2 -top-2 text-outline hover:text-on-surface"
          aria-label="Close"
        >
          <Icon name="close" />
        </button>
        <Icon name="lock" className="mb-4 text-4xl text-primary" />
        <h2 id="auth-gate-title" className="font-display-forge mb-2 text-xl font-bold">
          Sign in required
        </h2>
        <p className="mb-6 text-on-surface-variant">{message}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={loginHref} className="primary-button rounded-full px-8 py-3 font-semibold text-on-primary">
            Sign in
          </Link>
          <Link href={signupHref} className="rounded-full border border-outline-variant px-8 py-3 hover:border-primary">
            Create account
          </Link>
        </div>
      </div>
    </Dialog>
  );
}
