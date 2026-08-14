import { Comment, CommentModerationStatus } from './entities/comment.entity';
import { toPublicUserProfile, PublicUserProfile } from '../users/user.mapper';

export type PublicComment = {
  id: string;
  userId: string;
  user: PublicUserProfile;
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
  };
}
