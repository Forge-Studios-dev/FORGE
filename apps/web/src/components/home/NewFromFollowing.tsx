'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PaginatedResponse, Video } from '@/types';
import { FeedCard } from '@/components/FeedCard/FeedCard';
import { HorizontalCardSkeleton } from '@forge/design-system';

/**
 * "Latest from subscriptions" — personalized preview on home (YouTube-style).
 */
export function NewFromFollowing({ onViewAll }: { onViewAll: () => void }) {
  const { user, isGuest, canViewPersonalizedFeed, isLoading: authLoading } = useAuth();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [mutedChannels, setMutedChannels] = useState<Set<string>>(() => new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['home-following-preview', user?.id],
    enabled: !authLoading && !isGuest && canViewPersonalizedFeed,
    queryFn: async () => {
      const { data } = await api.get<{ data: PaginatedResponse<Video> }>(
        '/videos/feed/following?limit=8',
      );
      return data.data.data;
    },
  });

  if (!canViewPersonalizedFeed) return null;

  if (isLoading) {
    return (
      <section className="mb-12">
        <h2 className="font-display-forge mb-6 text-2xl font-semibold md:text-3xl">
          Latest from your subscriptions
        </h2>
        <HorizontalCardSkeleton count={4} />
      </section>
    );
  }

  const visible = (data ?? []).filter(
    (v) => !hiddenIds.has(v.id) && !mutedChannels.has(v.userId),
  );
  if (!visible.length) return null;

  return (
    <section className="mb-12 forge-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display-forge text-2xl font-semibold md:text-3xl">
          Latest from your subscriptions
        </h2>
        <button
          type="button"
          onClick={onViewAll}
          className="font-label-caps text-secondary hover:underline"
        >
          View all
        </button>
      </div>
      <div className="hide-scrollbar -mx-5 flex gap-6 overflow-x-auto px-5 md:mx-0 md:px-0">
        {visible.map((video) => (
          <FeedCard
            key={video.id}
            video={video}
            layout="carousel"
            onNotInterested={(id) => setHiddenIds((s) => new Set(s).add(id))}
            onDontRecommendChannel={(channelId) =>
              setMutedChannels((s) => new Set(s).add(channelId))
            }
          />
        ))}
      </div>
    </section>
  );
}
