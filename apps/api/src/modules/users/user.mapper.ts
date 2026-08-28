import { permissionsForUser } from '../../common/auth/permissions';
import { User, UserRole } from './entities/user.entity';

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
  adminTier?: User['adminTier'];
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
    adminTier: user.role === UserRole.ADMIN ? user.adminTier : undefined,
    usernameChangedAt: user.usernameChangedAt
      ? user.usernameChangedAt.toISOString()
      : null,
  };
}

/** Everything in PublicUser is safe to show the account owner; email is not safe to show anyone else. */
export type PublicUserProfile = Omit<PublicUser, 'email'>;

/**
 * Use for any *other* user shown to a viewer — comment/post/message authors,
 * video/stream owners, followers lists, channel pages. `toPublicUser` (with
 * email) is for the caller's own account only (GET /users/me, login/signup
 * response, DSAR export) — `email` was previously leaking to any viewer via
 * these call sites, including two fully unauthenticated ones
 * (GET /users/by-username/:username, GET /users/:id).
 */
export function toPublicUserProfile(user: User): PublicUserProfile {
  const { email: _email, ...rest } = toPublicUser(user);
  return rest;
}
