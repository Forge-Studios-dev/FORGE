export type AdminUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  role: string;
  isVerified: boolean;
  isActive?: boolean;
  deletedAt?: string | null;
  emailVerificationPending?: boolean;
  creatorStatus?: string | null;
  creatorRequestedAt?: string | null;
  creatorReviewedAt?: string | null;
  creatorReviewNote?: string | null;
  followerCount: number;
  followingCount: number;
  videoCount: number;
  createdAt: string;
  updatedAt: string;
  permissions?: string[];
};

export type AdminUserSummary = {
  user: AdminUser;
  videoStats: Record<string, number>;
  pendingReports: number;
  playlistCount: number;
};

export type AdminVideo = {
  id: string;
  title: string;
  status: string;
  visibility: string;
  viewCount: number;
  likeCount: number;
  commentCount?: number;
  createdAt: string;
  thumbnailUrl?: string | null;
  userId?: string;
};

export type AdminReport = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
  reporter?: { id?: string; username: string; email: string; displayName: string };
};

export type AdminPlaylist = {
  id: string;
  title: string;
  createdAt: string;
};
