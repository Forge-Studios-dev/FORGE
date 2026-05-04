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
  followerCount: number;
  followingCount: number;
  videoCount: number;
  createdAt: string;
}

export interface Video {
  id: string;
  userId: string;
  user: User;
  title: string;
  description?: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  visibility: 'public' | 'private' | 'unlisted';
  hlsUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  skillTags: SkillTag[];
  createdAt: string;
}

export interface Stream {
  id: string;
  userId: string;
  user: User;
  title: string;
  description?: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  status: 'idle' | 'live' | 'ended';
  viewerCount: number;
  startedAt?: string;
  createdAt: string;
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
  user: User;
  videoId: string;
  content: string;
  parentId?: string;
  likeCount: number;
  createdAt: string;
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
  user: Pick<User, 'id' | 'email' | 'username' | 'displayName' | 'avatarUrl' | 'role'>;
}
