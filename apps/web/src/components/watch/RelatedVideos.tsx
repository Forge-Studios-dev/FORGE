import { serverApi } from '@/lib/api';
import { Video } from '@/types';
import { RelatedVideosClient } from '@/components/watch/RelatedVideosClient';

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
    const { data } = await serverApi.get<{ data: { data: Video[] } }>(
      `/videos/${videoId}/related?limit=8`,
    );
    videos = (data.data?.data ?? []).filter((v) => v.id !== videoId).slice(0, 6);
    if (videos.length === 0 && skillTag) {
      const search = await serverApi.get<{ data: { videos: Video[] } }>(
        `/search?q=${encodeURIComponent(skillTag)}&limit=4`,
      );
      videos = (search.data.data?.videos ?? []).filter((v) => v.id !== videoId).slice(0, 4);
    }
  } catch {
    videos = [];
  }

  return <RelatedVideosClient videos={videos} />;
}
