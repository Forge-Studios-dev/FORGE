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
  nextCursor: string | null;
  hasMore: boolean;
};

export type StudioCommentFilter = 'all' | 'held' | 'pinned' | 'hearted';

/** Dedicated creator-comments inbox — cursor-paginated across all owned videos. */
export async function fetchStudioComments(opts?: {
  filter?: StudioCommentFilter;
  q?: string;
  limit?: number;
  cursor?: string | null;
}): Promise<StudioCommentsResult> {
  const params = new URLSearchParams();
  const filter = opts?.filter ?? 'all';
  if (filter !== 'all') params.set('filter', filter);
  const q = opts?.q?.trim();
  if (q && q.length >= 2) params.set('q', q);
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.cursor) params.set('cursor', opts.cursor);

  const qs = params.toString();
  const { data } = await api.get<{
    data: {
      data: StudioCommentItem[];
      meta: { cursor: string | null; hasMore: boolean };
    };
  }>(`/creators/me/comments${qs ? `?${qs}` : ''}`);

  const payload = data.data;
  return {
    items: payload.data ?? [],
    nextCursor: payload.meta?.cursor ?? null,
    hasMore: !!payload.meta?.hasMore,
  };
}

/** @deprecated Prefer `fetchStudioComments` — kept for any leftover callers. */
export async function getRecentCommentsOnMyVideos(
  _userId: string | undefined,
  opts?: {
    filter?: StudioCommentFilter;
    q?: string;
    limit?: number;
    cursor?: string | null;
  },
): Promise<StudioCommentsResult> {
  return fetchStudioComments(opts);
}

export type StudioModerationInboxItem = {
  id: string;
  communityId: string;
  communityName?: string;
  targetType?: string;
  status: string;
  reason?: string;
  createdAt: string;
};

export type StudioModerationInboxResult = {
  items: StudioModerationInboxItem[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
};

/** Unified community-report inbox — cursor-paginated across owned/moderated communities. */
export async function fetchStudioModerationInbox(opts?: {
  status?: string;
  limit?: number;
  cursor?: string | null;
}): Promise<StudioModerationInboxResult> {
  const params = new URLSearchParams();
  if (opts?.status && opts.status !== 'open') params.set('status', opts.status);
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.cursor) params.set('cursor', opts.cursor);

  const qs = params.toString();
  const { data } = await api.get<{
    data: {
      data: StudioModerationInboxItem[];
      meta: { cursor: string | null; hasMore: boolean; total?: number };
    };
  }>(`/creators/me/moderation/inbox${qs ? `?${qs}` : ''}`);

  const payload = data.data;
  return {
    items: payload.data ?? [],
    nextCursor: payload.meta?.cursor ?? null,
    hasMore: !!payload.meta?.hasMore,
    total: payload.meta?.total ?? payload.data?.length ?? 0,
  };
}
