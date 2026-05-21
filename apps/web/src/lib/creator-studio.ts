import { api } from '@/lib/api';
import { Comment, Video } from '@/types';

/** Studio list — all statuses (uploading, processing, ready, failed). */
export async function getStudioVideos(): Promise<Video[]> {
  const { data } = await api.get<{ data: { data: Video[] } }>('/videos/studio');
  return data.data?.data ?? [];
}

/** @deprecated use getStudioVideos */
export async function getMyVideos(userId: string | undefined): Promise<Video[]> {
  if (!userId) return [];
  return getStudioVideos();
}

export type StudioCommentItem = Comment & { videoTitle: string };

export async function getRecentCommentsOnMyVideos(
  userId: string | undefined,
  limitPerVideo = 5,
): Promise<StudioCommentItem[]> {
  const videos = (await getStudioVideos()).filter((v) => v.status === 'ready');
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
