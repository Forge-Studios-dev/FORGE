import { publicVideoPath } from '@/lib/watch-url';
import { api } from '@/lib/api';
import { Comment, Video } from '@/types';

/** Studio list — all statuses (uploading, processing, ready, failed). */
export async function getStudioVideos(): Promise<Video[]> {
  const page = await fetchStudioLibrary({ limit: 100, page: 1 });
  return page.items;
}

export type StudioVideoSort = 'recent' | 'oldest' | 'views' | 'title';

/** @deprecated prefer `publicVideoPath` from `@/lib/watch-url` */
export function studioPublicPath(video: Pick<Video, 'id' | 'videoType'>): string {
  return publicVideoPath(video);
}

export interface StudioLibraryParams {
  search?: string;
  sort?: StudioVideoSort;
  status?: string;
  visibility?: string;
  /** `video` | `short` */
  videoType?: string;
  categoryId?: string;
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
  if (params.categoryId) qs.set('categoryId', params.categoryId);
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

export type StudioCommentItem = Comment & {
  videoTitle: string;
  videoType?: string | null;
};

export type StudioCommentsResult = {
  items: StudioCommentItem[];
  /** Client-side cap or more videos exist — inbox is a recent slice, not exhaustive. */
  truncated: boolean;
  videosScanned: number;
};

/** No dedicated creator-comments list API — scan recent ready videos. */
const STUDIO_COMMENTS_VIDEO_LIMIT = 24;
const STUDIO_COMMENTS_PER_VIDEO = 8;
const STUDIO_COMMENTS_MAX = 80;

export async function getRecentCommentsOnMyVideos(
  userId: string | undefined,
  opts?: {
    videoLimit?: number;
    limitPerVideo?: number;
    maxComments?: number;
  },
): Promise<StudioCommentsResult> {
  if (!userId) return { items: [], truncated: false, videosScanned: 0 };

  const videoLimit = opts?.videoLimit ?? STUDIO_COMMENTS_VIDEO_LIMIT;
  const limitPerVideo = opts?.limitPerVideo ?? STUDIO_COMMENTS_PER_VIDEO;
  const maxComments = opts?.maxComments ?? STUDIO_COMMENTS_MAX;

  const { items: videos, pagination } = await fetchStudioLibrary({
    status: 'ready',
    sort: 'recent',
    limit: videoLimit,
  });
  if (!videos.length) return { items: [], truncated: false, videosScanned: 0 };

  const settled = await Promise.allSettled(
    videos.map(async (video) => {
      const { data } = await api.get<{ data: { data: Comment[] } }>(
        `/videos/${video.id}/comments?limit=${limitPerVideo}`,
      );
      return (data.data.data ?? []).map((c) => ({
        ...c,
        videoTitle: video.title,
        videoType: video.videoType,
      }));
    }),
  );

  const batches: StudioCommentItem[][] = [];
  let failures = 0;
  let firstError: unknown;
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      batches.push(result.value);
    } else {
      failures += 1;
      if (!firstError) firstError = result.reason;
    }
  }

  if (batches.length === 0 && failures > 0) {
    throw firstError instanceof Error ? firstError : new Error('Failed to load comments');
  }

  const sorted = batches
    .flat()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const items = sorted.slice(0, maxComments);
  const truncated = sorted.length > maxComments || pagination.hasMore;

  return { items, truncated, videosScanned: videos.length };
}
