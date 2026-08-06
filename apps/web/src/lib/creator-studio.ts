import { api } from '@/lib/api';
import { Comment, Video } from '@/types';

/** Studio list — all statuses (uploading, processing, ready, failed). */
export async function getStudioVideos(): Promise<Video[]> {
  const { data } = await api.get<{ data: { data: Video[] } }>('/videos/studio');
  return data.data?.data ?? [];
}

export type StudioVideoSort = 'recent' | 'oldest' | 'views' | 'title';

/** Public viewer URL path for Studio View / Copy link (Shorts vs watch). */
export function studioPublicPath(video: Pick<Video, 'id' | 'videoType'>): string {
  return video.videoType === 'short' ? `/shorts?v=${video.id}` : `/watch/${video.id}`;
}

export interface StudioLibraryParams {
  search?: string;
  sort?: StudioVideoSort;
  status?: string;
  visibility?: string;
  /** `video` | `short` */
  videoType?: string;
  scheduled?: boolean;
  page?: number;
  limit?: number;
}

export interface StudioLibraryPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface StudioLibraryPage {
  items: Video[];
  pagination: StudioLibraryPagination;
}

/**
 * Paginated, server-filtered Studio content library. Lets creators reach their
 * full library (beyond the legacy 100-row cap) and search/sort server-side.
 */
export async function fetchStudioLibrary(
  params: StudioLibraryParams = {},
): Promise<StudioLibraryPage> {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.sort) qs.set('sort', params.sort);
  if (params.status) qs.set('status', params.status);
  if (params.visibility) qs.set('visibility', params.visibility);
  if (params.videoType) qs.set('videoType', params.videoType);
  if (params.scheduled) qs.set('scheduled', 'true');
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  const { data } = await api.get<{
    data: { data: Video[]; pagination?: StudioLibraryPagination };
  }>(`/videos/studio${query ? `?${query}` : ''}`);
  return {
    items: data.data?.data ?? [],
    pagination:
      data.data?.pagination ?? { page: 1, limit: 0, total: 0, hasMore: false },
  };
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
