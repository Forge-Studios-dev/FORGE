'use client';

import Link from 'next/link';
import { Icon } from '@forge/design-system';

export function AuthGateModal({
  open,
  onClose,
  message = 'Sign in to like, comment, and follow creators.',
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
}) {
  const returnPath =
    typeof window !== 'undefined'
      ? encodeURIComponent(window.location.pathname + window.location.search)
      : encodeURIComponent('/');
  const loginHref = `/login?next=${returnPath}`;
  const signupHref = `/signup?next=${returnPath}`;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="glass-panel relative w-full max-w-md rounded-2xl p-8 text-center">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-outline hover:text-on-surface"
          aria-label="Close"
        >
          <Icon name="close" />
        </button>
        <Icon name="lock" className="mb-4 text-4xl text-primary" />
        <h2 className="font-display-forge mb-2 text-xl font-bold">Sign in required</h2>
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
    </div>
  );
}
