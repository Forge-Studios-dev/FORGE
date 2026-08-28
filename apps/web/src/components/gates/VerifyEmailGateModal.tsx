'use client';

import Link from 'next/link';
import { Icon, buttonClassName } from '@forge/design-system';
import { Dialog } from '@forge/design-system/client';

export function VerifyEmailGateModal({
  open,
  onClose,
  message = 'Verify your email to like, comment, subscribe, and use your library.',
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="verify-email-gate-title">
      <div className="relative text-center">
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-2 -top-2 text-outline hover:text-on-surface"
          aria-label="Close"
        >
          <Icon name="close" />
        </button>
        <Icon name="mail" className="mb-4 text-4xl text-primary" />
        <h2 id="verify-email-gate-title" className="font-display-forge mb-2 text-xl font-bold">
          Verify your email
        </h2>
        <p className="mb-6 text-on-surface-variant">{message}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/verify-email" className={buttonClassName('primary')}>
            Verify email
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-outline-variant px-8 py-3 hover:border-primary"
          >
            Keep browsing
          </button>
        </div>
      </div>
    </Dialog>
  );
}
