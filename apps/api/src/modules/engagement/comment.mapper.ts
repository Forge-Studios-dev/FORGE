import { Comment, CommentModerationStatus } from './entities/comment.entity';
import { toPublicUserProfile, PublicUserProfile } from '../users/user.mapper';

export type PublicComment = {
  id: string;
  userId: string | null;
  user: PublicUserProfile | null;
  videoId: string;
  content: string;
  parentId: string | null;
  likeCount: number;
  replyCount?: number;
  isPinned: boolean;
  creatorHearted: boolean;
  viewerLiked?: boolean;
  viewerDisliked?: boolean;
  createdAt: Date;
  /** Only populated for the video owner/admin — flags a comment awaiting moderation review. */
  moderationStatus?: CommentModerationStatus;
  /** Soft-deleted but kept in the thread because it still has live replies — content/author are masked, not real. */
  isDeleted: boolean;
};

export function toPublicComment(
  comment: Comment,
  extras?: {
    viewerLiked?: boolean;
    viewerDisliked?: boolean;
    replyCount?: number;
    includeModerationStatus?: boolean;
  },
): PublicComment {
  if (comment.deletedAt) {
    // A deleted comment only ever reaches this mapper when it still has live
    // replies (see getComments/getCommentReplies) — removed as a full row
    // from every listing otherwise. Mask identity/content; keep id/parentId/
    // createdAt/replyCount so the reply thread stays anchored and orderable.
    return {
      id: comment.id,
      userId: null,
      user: null,
      videoId: comment.videoId,
      content: '[deleted]',
      parentId: comment.parentId,
      likeCount: 0,
      replyCount: extras?.replyCount,
      isPinned: false,
      creatorHearted: false,
      viewerLiked: undefined,
      viewerDisliked: undefined,
      createdAt: comment.createdAt,
      moderationStatus: undefined,
      isDeleted: true,
    };
  }
  return {
    id: comment.id,
    userId: comment.userId,
    user: toPublicUserProfile(comment.user),
    videoId: comment.videoId,
    content: comment.content,
    parentId: comment.parentId,
    likeCount: comment.likeCount,
    replyCount: extras?.replyCount,
    isPinned: !!comment.isPinned,
    creatorHearted: !!comment.creatorHearted,
    viewerLiked: extras?.viewerLiked,
    viewerDisliked: extras?.viewerDisliked,
    createdAt: comment.createdAt,
    moderationStatus: extras?.includeModerationStatus ? comment.moderationStatus : undefined,
    isDeleted: false,
  };
}
