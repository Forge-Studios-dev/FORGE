import { serverApi } from '@/lib/api';
import { FeedCard } from '@/components/FeedCard/FeedCard';
import { Video } from '@/types';

export async function RelatedVideos({
  videoId,
  skillTag,
}: {
  videoId: string;
  /** Accepted for caller compatibility; related ranking now handles creator affinity server-side. */
  creatorId?: string;
  skillTag?: string;
}) {
  let videos: Video[] = [];
  try {
    // Content-based recommendations (shared skill tags / category / creator).
    const { data } = await serverApi.get<{ data: { data: Video[] } }>(
      `/videos/${videoId}/related?limit=8`,
    );
    videos = (data.data?.data ?? []).filter((v) => v.id !== videoId).slice(0, 6);
    // Last-resort fallback if the related rail is empty for a brand-new catalog.
    if (videos.length === 0 && skillTag) {
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
        <FeedCard key={video.id} video={video} layout="sidebar" />
      ))}
    </div>
  );
}
