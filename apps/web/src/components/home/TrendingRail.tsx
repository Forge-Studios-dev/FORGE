'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { FeedCard } from '@/components/FeedCard/FeedCard';
import { Video } from '@/types';

type Props = {
  videos: Video[];
};

/** Horizontal trending row on the homepage */
export function TrendingRail({ videos }: Props) {
  useAuth();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [mutedChannels, setMutedChannels] = useState<Set<string>>(() => new Set());

  const visible = videos
    .filter((v) => !hiddenIds.has(v.id) && !mutedChannels.has(v.userId))
    .slice(0, 6);

  if (visible.length === 0) return null;

  return (
    <section className="mb-12 forge-fade-in">
      <h2 className="font-display-forge mb-6 text-2xl font-semibold md:text-3xl">Trending</h2>
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
