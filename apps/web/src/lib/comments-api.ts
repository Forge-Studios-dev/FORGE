import { api } from '@/lib/api';
import type { Comment } from '@/types';

export type CommentSort = 'top' | 'newest' | 'oldest';

export type CommentsPage = {
  data: Comment[];
  meta: { cursor: string | null; hasMore: boolean; total?: number; sort?: string };
};

export type ListCommentsParams = {
  limit?: number;
  sort?: CommentSort;
  cursor?: string | null;
};

export async function listComments(
  videoId: string,
  params: ListCommentsParams = {},
): Promise<CommentsPage> {
  const qs = new URLSearchParams();
  qs.set('limit', String(params.limit ?? 20));
  if (params.sort) qs.set('sort', params.sort);
  if (params.cursor) qs.set('cursor', params.cursor);
  const { data } = await api.get<{ data: CommentsPage }>(`/videos/${videoId}/comments?${qs}`);
  return data.data;
}

export async function listCommentReplies(
  videoId: string,
  commentId: string,
  params: { limit?: number; cursor?: string } = {},
): Promise<CommentsPage> {
  const qs = new URLSearchParams({ limit: String(params.limit ?? 20) });
  if (params.cursor) qs.set('cursor', params.cursor);
  const { data } = await api.get<{ data: CommentsPage }>(
    `/videos/${videoId}/comments/${commentId}/replies?${qs}`,
  );
  return data.data;
}

export async function getComment(videoId: string, commentId: string): Promise<Comment> {
  const { data } = await api.get<{ data: Comment }>(`/videos/${videoId}/comments/${commentId}`);
  return data.data;
}

export async function createComment(
  videoId: string,
  body: { content: string; parentId?: string },
): Promise<Comment> {
  const { data } = await api.post<{ data: Comment }>(`/videos/${videoId}/comments`, body);
  return data.data;
}

export async function updateComment(
  videoId: string,
  commentId: string,
  body: { content: string },
): Promise<void> {
  await api.patch(`/videos/${videoId}/comments/${commentId}`, body);
}

export async function deleteComment(videoId: string, commentId: string): Promise<void> {
  await api.delete(`/videos/${videoId}/comments/${commentId}`);
}

export async function likeComment(videoId: string, commentId: string): Promise<void> {
  await api.post(`/videos/${videoId}/comments/${commentId}/like`);
}

export async function unlikeComment(videoId: string, commentId: string): Promise<void> {
  await api.delete(`/videos/${videoId}/comments/${commentId}/like`);
}

export async function dislikeComment(videoId: string, commentId: string): Promise<void> {
  await api.post(`/videos/${videoId}/comments/${commentId}/dislike`);
}

export async function undislikeComment(videoId: string, commentId: string): Promise<void> {
  await api.delete(`/videos/${videoId}/comments/${commentId}/dislike`);
}

export async function pinComment(
  videoId: string,
  commentId: string,
  isPinned: boolean,
): Promise<void> {
  await api.post(`/videos/${videoId}/comments/${commentId}/pin`, { isPinned });
}

export async function setCreatorHeart(
  videoId: string,
  commentId: string,
  creatorHearted: boolean,
): Promise<void> {
  await api.post(`/videos/${videoId}/comments/${commentId}/creator-heart`, { creatorHearted });
}

export async function reportComment(
  commentId: string,
  body: { reason: string; reasonCategory?: string },
): Promise<void> {
  await api.post('/reports', {
    targetType: 'comment',
    targetId: commentId,
    reason: body.reason,
    ...(body.reasonCategory ? { reasonCategory: body.reasonCategory } : {}),
  });
}
