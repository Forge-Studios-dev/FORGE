import { permissionsForUser } from '../../common/auth/permissions';
import { User } from './entities/user.entity';

export type PublicUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  role: User['role'];
  isVerified: boolean;
  creatorStatus: User['creatorStatus'];
  creatorReviewNote?: string | null;
  followerCount: number;
  followingCount: number;
  videoCount: number;
  createdAt: Date;
  updatedAt: Date;
  permissions: ReturnType<typeof permissionsForUser>;
  viewerFollowing?: boolean;
};

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    role: user.role,
    isVerified: user.isVerified,
    creatorStatus: user.creatorStatus,
    creatorReviewNote: user.creatorReviewNote,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    videoCount: user.videoCount,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    permissions: permissionsForUser(user),
  };
}
