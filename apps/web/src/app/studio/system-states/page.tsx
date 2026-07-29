'use client';

import Link from 'next/link';
import { PageHeader } from '@forge/design-system';

const STATE_CARDS = [
  {
    title: 'Empty',
    detail: 'Used across videos, comments, resources, and queues when there is nothing to show yet.',
    href: '/studio/videos',
  },
  {
    title: 'Loading',
    detail: 'Studio route loading skeleton while React Query / page transitions settle.',
    href: '/studio/analytics',
  },
  {
    title: 'Offline',
    detail: 'Runtime banner appears automatically when the browser goes offline.',
    href: '/studio',
  },
  {
    title: 'Slow network',
    detail: 'Latency probe warns creators before large uploads on degraded connections.',
    href: '/upload',
  },
  {
    title: 'Permission denied',
    detail: 'StudioGate covers guest, viewer, pending, rejected, admin-blocked, and collaborator (mod/coach) entry.',
    href: '/studio',
  },
  {
    title: 'Collaborator shell',
    detail: 'Delegated moderators/coaches get a restricted Studio nav focused on moderation and messages.',
    href: '/studio/moderation',
  },
  {
    title: 'Upload recovery',
    detail: 'Cancel / clear stuck uploads and resumable multipart progress live in Videos + Upload Reliability.',
    href: '/studio/upload-reliability',
  },
  {
    title: 'Payment risk',
    detail: 'Failed payments surface in Attention and Subscribers for creator follow-up.',
    href: '/studio/attention',
  },
  {
    title: 'Processing detail',
    detail: 'Video editor shows transcode status, failure reason, and retry for failed lessons.',
    href: '/studio/videos',
  },
  {
    title: 'CSV export progress',
    detail: 'Subscribers export uses an authenticated download with a preparing/downloading progress modal.',
    href: '/studio/subscribers',
  },
  {
    title: 'Session expiry',
    detail: 'API 401 redirects to /session-expired and returns creators to their Studio path after sign-in.',
    href: '/session-expired?next=%2Fstudio',
  },
  {
    title: 'Publish success',
    detail: 'Upload success route confirms publish/schedule after the multi-step flow.',
    href: '/upload/success',
  },
] as const;

/**
 * Lightweight reference board for Phase 4 shared states.
 * Keeps creators/devs oriented to where each production state is handled.
 */
export default function StudioSystemStatesPage() {
  return (
    <main className="space-y-6">
      <PageHeader
        title="System states"
        subtitle="Where Studio handles empty, loading, offline, permission, and recovery experiences."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {STATE_CARDS.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="glass-panel rounded-2xl p-5 transition-colors hover:border-primary/30"
          >
            <h2 className="font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm text-on-surface-variant">{card.detail}</p>
            <p className="mt-3 text-sm text-primary">Open example →</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
