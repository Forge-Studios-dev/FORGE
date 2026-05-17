import { api } from '@/lib/api';
import { Comment, Video } from '@/types';
export async function getMyVideos(userId: string | undefined): Promise<Video[]> {
  if (!userId) return [];
  const { data } = await api.get<{ data: { data: Video[] } }>(`/users/${userId}/videos?limit=50`);
  return data.data.data ?? [];
}

export type StudioCommentItem = Comment & { videoTitle: string };

export async function getRecentCommentsOnMyVideos(
  userId: string | undefined,
  limitPerVideo = 5,
): Promise<StudioCommentItem[]> {
  const videos = await getMyVideos(userId);
  if (!videos.length) return [];

  const batches = await Promise.all(
    videos.slice(0, 8).map(async (video) => {
      try {
        const { data } = await api.get<{ data: { data: Comment[] } }>(
          `/videos/${video.id}/comments?limit=${limitPerVideo}`,
        );
        return (data.data.data ?? []).map((c) => ({ ...c, videoTitle: video.title }));
      } catch {
        return [];
      }
    }),
  );

  return batches
    .flat()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);
}
