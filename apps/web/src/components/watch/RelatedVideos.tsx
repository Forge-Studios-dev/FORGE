import { serverApi } from '@/lib/api';
import { FeedCard } from '@/components/FeedCard/FeedCard';
import { Video } from '@/types';

export async function RelatedVideos({
  videoId,
  creatorId,
  skillTag,
}: {
  videoId: string;
  creatorId: string;
  skillTag?: string;
}) {
  let videos: Video[] = [];
  try {
    const { data } = await serverApi.get<{ data: { data: Video[] } }>('/videos/feed?limit=8');
    videos = (data.data?.data ?? []).filter((v) => v.id !== videoId && v.userId !== creatorId).slice(0, 4);
    if (videos.length < 2 && skillTag) {
      const search = await serverApi.get<{ data: { videos: Video[] } }>(
        `/search?q=${encodeURIComponent(skillTag)}&limit=4`,
      );
      videos = (search.data.data?.videos ?? []).filter((v) => v.id !== videoId).slice(0, 4);
    }
  } catch {
    videos = [];
  }

  if (videos.length === 0) {
    return <p className="text-sm text-on-surface-variant">No related lessons yet.</p>;
  }

  return (
    <div className="forge-stagger space-y-4">
      {videos.map((video) => (
        <FeedCard key={video.id} video={video} compact />
      ))}
    </div>
  );
}
