export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  role: 'user' | 'creator' | 'admin';
  isVerified: boolean;
  creatorStatus?: 'pending' | 'approved' | 'rejected' | null;
  creatorReviewNote?: string | null;
  permissions?: string[];
  followerCount: number;
  followingCount: number;
  videoCount: number;
  createdAt: string;
}

export interface Video {
  id: string;
  userId: string;
  user?: User;
  title: string;
  description?: string;
  status: 'uploading' | 'pending' | 'processing' | 'ready' | 'failed';
  visibility: 'public' | 'private' | 'unlisted' | 'followers' | 'subscribers' | 'tier' | 'paid_event';
  hlsUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  skillTags: SkillTag[];
  categoryId?: string | null;
  createdAt: string;
  requiredTierId?: string | null;
  sourceStreamId?: string | null;
  publishedAt?: string | null;
  scheduledPublishAt?: string | null;
  accessDenied?: boolean;
  accessReason?: string;
}

export interface Stream {
  id: string;
  userId: string;
  user?: User;
  title: string;
  description?: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  streamKey?: string;
  rtmpUrl?: string;
  status: 'idle' | 'live' | 'ended';
  visibility?: 'public' | 'followers' | 'subscribers' | 'tier' | 'private' | 'paid_event';
  categoryId?: string | null;
  chatEnabled?: boolean;
  recordEnabled?: boolean;
  ageRestricted?: boolean;
  requiredTierId?: string | null;
  accessDenied?: boolean;
  accessReason?: string;
  slowModeSeconds?: number;
  viewerCount: number;
  startedAt?: string;
  createdAt: string;
}

export interface SubscriptionTier {
  id: string;
  creatorId: string;
  name: string;
  slug: string;
  priceCents: number;
  currency: string;
  benefits: string[];
  sortOrder: number;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  iconUrl?: string;
  description?: string;
  sortOrder: number;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
}

export interface SkillTag {
  id: string;
  subcategoryId: string;
  name: string;
  slug: string;
}

export interface Comment {
  id: string;
  userId: string;
  user?: User;
  videoId: string;
  content: string;
  parentId?: string;
  likeCount: number;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'creator_approved' | 'creator_rejected' | 'video_ready' | 'stream_started';
  title: string;
  body?: string | null;
  readAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Playlist {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  items?: Array<{
    id: string;
    playlistId: string;
    videoId: string;
    createdAt: string;
    video: Video;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
    total?: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  sessionId?: string;
  user: Pick<
    User,
    | 'id'
    | 'email'
    | 'username'
    | 'displayName'
    | 'avatarUrl'
    | 'role'
    | 'isVerified'
    | 'creatorStatus'
    | 'creatorReviewNote'
    | 'permissions'
  >;
}
