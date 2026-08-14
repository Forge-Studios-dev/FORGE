'use client';

import { useState } from 'react';
import { EmptyState } from '@forge/design-system';
import { FeedCard } from '@/components/FeedCard/FeedCard';
import { Video } from '@/types';

export function RelatedVideosClient({ videos: initial }: { videos: Video[] }) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [mutedChannels, setMutedChannels] = useState<Set<string>>(() => new Set());

  const videos = initial.filter(
    (v) => !hiddenIds.has(v.id) && !mutedChannels.has(v.userId),
  );

  if (!videos.length) {
    return (
      <EmptyState
        icon="playlist_play"
        title="No related videos"
        description="Try another video or browse Home for more to watch."
        action={{ label: 'Home', href: '/' }}
      />
    );
  }

  return (
    <div className="forge-stagger space-y-4">
      {videos.map((video) => (
        <FeedCard
          key={video.id}
          video={video}
          layout="sidebar"
          onNotInterested={(id) => setHiddenIds((prev) => new Set(prev).add(id))}
          onDontRecommendChannel={(channelId) =>
            setMutedChannels((prev) => new Set(prev).add(channelId))
          }
        />
      ))}
    </div>
  );
}
