'use client';

import Link from 'next/link';
import { Icon, buttonClassName } from '@forge/design-system';
import { useAuth } from '@/lib/auth';

export function HomeFeedSections() {
  const { isGuest, isCreator, canApplyForCreator } = useAuth();

  return (
    <>
      {isGuest && (
        <section className="mb-10 rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center md:text-left">
          <h2 className="font-display-forge mb-2 text-3xl font-bold text-primary md:text-4xl">Watch what you love</h2>
          <p className="mb-6 text-on-surface-variant">
            Explore videos and live streams from creators. Sign in to subscribe and build your library.
          </p>
          <div className="flex flex-wrap justify-center gap-3 md:justify-start">
            <Link href="/signup" className={buttonClassName('primary')}>
              Get started
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-outline-variant px-8 py-3 text-on-surface hover:border-primary"
            >
              Sign in
            </Link>
          </div>
        </section>
      )}

      {isCreator && (
        <section className="mb-8 flex flex-col gap-4 rounded-xl border border-secondary/30 bg-secondary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-label-caps text-secondary">Creator mode</p>
            <p className="text-sm text-on-surface-variant">Manage uploads and analytics in Studio</p>
          </div>
          <Link href="/studio" className={`${buttonClassName('primary')} shrink-0 text-center`}>
            Open Studio
          </Link>
        </section>
      )}

      {canApplyForCreator && (
        <section className="mb-10 rounded-xl border border-outline-variant/30 bg-surface-container p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Icon name="auto_videocam" className="text-3xl text-primary" />
            <div className="flex-1">
              <h3 className="font-display-forge text-lg font-semibold">Create on FORGE</h3>
              <p className="text-sm text-on-surface-variant">Apply to become a creator and upload videos.</p>
            </div>
            <Link
              href="/upload/become-creator"
              className="shrink-0 rounded-full border border-primary px-6 py-2 text-center text-sm text-primary hover:bg-primary/10"
            >
              Apply now
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
