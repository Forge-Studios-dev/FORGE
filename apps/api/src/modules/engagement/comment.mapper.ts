import { Comment } from './entities/comment.entity';
import { toPublicUser, PublicUser } from '../users/user.mapper';

export type PublicComment = {
  id: string;
  userId: string;
  user: PublicUser;
  videoId: string;
  content: string;
  parentId: string | null;
  likeCount: number;
  viewerLiked?: boolean;
  createdAt: Date;
};

export function toPublicComment(
  comment: Comment,
  extras?: { viewerLiked?: boolean },
): PublicComment {
  return {
    id: comment.id,
    userId: comment.userId,
    user: toPublicUser(comment.user),
    videoId: comment.videoId,
    content: comment.content,
    parentId: comment.parentId,
    likeCount: comment.likeCount,
    viewerLiked: extras?.viewerLiked,
    createdAt: comment.createdAt,
  };
}
