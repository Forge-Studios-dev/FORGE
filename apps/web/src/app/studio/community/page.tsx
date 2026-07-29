'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Community } from '@/types/community';

export default function StudioCommunityRedirectPage() {
  const router = useRouter();
  const { user, isCreator } = useAuth();

  const { data: communities } = useQuery({
    queryKey: ['studio-communities', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: Community[] }>(`/creators/${user!.id}/communities`);
      return data.data;
    },
  });

  useEffect(() => {
    if (!isCreator) return;
    if (communities === undefined) return;
    if (communities.length > 0) {
      router.replace(`/studio/communities/${communities[0]!.id}`);
    } else {
      router.replace('/studio/communities');
    }
  }, [communities, isCreator, router]);

  if (!isCreator) {
    return (
      <main className="space-y-6">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <p className="text-sm text-on-surface-variant">Redirecting to community manager…</p>
    </main>
  );
}
