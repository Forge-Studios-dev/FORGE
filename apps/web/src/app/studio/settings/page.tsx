'use client';

import Link from 'next/link';
import { PageHeader } from '@forge/design-system';
import { useAuth } from '@/lib/auth';

export default function StudioSettingsPage() {
  const { user } = useAuth();

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader title="Studio settings" subtitle="Channel and creator preferences" />
      <div className="glass-panel space-y-4 rounded-xl p-6">
        <div>
          <p className="font-label-caps text-outline">Display name</p>
          <p className="text-on-surface">{user?.displayName ?? '—'}</p>
        </div>
        <div>
          <p className="font-label-caps text-outline">Username</p>
          <p className="text-on-surface">@{user?.username ?? '—'}</p>
        </div>
        <div>
          <p className="font-label-caps text-outline">Email</p>
          <p className="text-on-surface">{user?.email ?? '—'}</p>
        </div>
        <Link
          href="/profile/settings"
          className="primary-button inline-block rounded-full px-6 py-2 text-sm font-semibold text-on-primary"
        >
          Edit profile settings
        </Link>
      </div>
    </main>
  );
}
