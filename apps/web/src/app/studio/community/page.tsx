'use client';

import Link from 'next/link';
import { PageHeader } from '@forge/design-system';
import { ChannelCommunityFeed } from '@/components/Community/ChannelCommunityFeed';
import { useAuth } from '@/lib/auth';

export default function StudioCommunityPage() {
  const { user, isCreator } = useAuth();

  if (!isCreator || !user?.id || !user.username) {
    return (
      <main className="space-y-4">
        <PageHeader title="Community" subtitle="Sign in as an approved creator to post updates." />
        <Link href="/studio" className="text-sm text-primary hover:underline">
          Back to Studio
        </Link>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Community"
        subtitle="Post text and images to your channel Community tab — same feed viewers see on your channel."
      />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href={`/${user.username}?tab=community`}
          className="text-primary hover:underline"
        >
          View public Community tab
        </Link>
        <Link href="/studio/moderation" className="text-on-surface-variant hover:underline">
          Moderation inbox
        </Link>
      </div>
      <ChannelCommunityFeed creatorId={user.id} username={user.username} />
    </main>
  );
}
