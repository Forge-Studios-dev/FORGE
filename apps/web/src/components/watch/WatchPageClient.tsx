'use client';

import { WatchExperience } from '@/components/watch/WatchExperience';
import { Video } from '@/types';

export function WatchPageClient({ video }: { video: Video }) {
  return <WatchExperience video={video} />;
}
