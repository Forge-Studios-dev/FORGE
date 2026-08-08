import { permissionsForUser } from '../../common/auth/permissions';
import { User } from './entities/user.entity';

export type PublicUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio?: string | null;
  websiteUrl?: string | null;
  channelLinks?: { title: string; url: string }[] | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  role: User['role'];
  isVerified: boolean;
  creatorStatus: User['creatorStatus'];
  creatorReviewNote?: string | null;
  /** @deprecated Prefer subscriberCount (YouTube Subscribe model). */
  followerCount: number;
  /** Channels this user is subscribed to. */
  followingCount: number;
  /** YouTube-facing alias for followerCount. */
  subscriberCount: number;
  /** YouTube-facing alias for followingCount. */
  subscriptionCount: number;
  videoCount: number;
  createdAt: Date;
  updatedAt: Date;
  permissions: ReturnType<typeof permissionsForUser>;
  /** @deprecated Prefer viewerSubscribed. */
  viewerFollowing?: boolean;
  viewerSubscribed?: boolean;
  /** ISO time of last handle change; clients use for rename cooldown copy. */
  usernameChangedAt?: string | null;
};

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    websiteUrl: user.websiteUrl ?? null,
    channelLinks: user.channelLinks ?? null,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    role: user.role,
    isVerified: user.isVerified,
    creatorStatus: user.creatorStatus,
    creatorReviewNote: user.creatorReviewNote,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    subscriberCount: user.followerCount,
    subscriptionCount: user.followingCount,
    videoCount: user.videoCount,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    permissions: permissionsForUser(user),
    usernameChangedAt: user.usernameChangedAt
      ? user.usernameChangedAt.toISOString()
      : null,
  };
}
