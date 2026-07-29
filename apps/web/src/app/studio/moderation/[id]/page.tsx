'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { StudioModerationPanel } from '@/components/Community/StudioModerationPanel';

export default function StudioModerationDetailPage() {
  const params = useParams();
  const communityId = params.id as string;

  const { data: community, isLoading } = useQuery({
    queryKey: ['community-by-id', communityId],
    queryFn: async () => {
      const { data } = await api.get<{
        data: { community: { id: string; name: string; slug: string; creatorId: string } };
      }>(`/communities/id/${communityId}`);
      return data.data.community;
    },
  });

  if (isLoading) {
    return (
      <main className="space-y-6">
        <p className="text-sm text-on-surface-variant">Loading…</p>
      </main>
    );
  }

  if (!community) {
    return (
      <main className="space-y-6">
        <p className="text-sm text-on-surface-variant">Community not found or access denied.</p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title={`Moderate: ${community.name}`}
        subtitle="Reports, bans, and role management for delegated moderators"
      />
      <StudioModerationPanel communityId={communityId} />
      <Link href="/studio/moderation" className="mt-8 inline-block text-sm text-primary hover:underline">
        ← All moderated communities
      </Link>
    </main>
  );
}
