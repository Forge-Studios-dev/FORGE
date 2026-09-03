/**
 * Canonical public domain contracts for web/admin/mobile clients.
 * API entities may map into these shapes; keep field names stable.
 */

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio?: string;
  websiteUrl?: string | null;
  channelLinks?: { title: string; url: string }[] | null;
  avatarUrl?: string;
  bannerUrl?: string;
  role: 'user' | 'creator' | 'admin';
  isVerified: boolean;
  creatorStatus?: 'pending' | 'approved' | 'rejected' | null;
  creatorReviewNote?: string | null;
  permissions?: string[];
  followerCount: number;
  followingCount: number;
  subscriberCount?: number;
  subscriptionCount?: number;
  videoCount: number;
  createdAt: string;
  viewerFollowing?: boolean;
  viewerSubscribed?: boolean;
  viewerBlocked?: boolean;
  /** ISO timestamp of last username change (rename cooldown). */
  usernameChangedAt?: string | null;
  /** Present on own Manage subscriptions list only. */
  notifyLevel?: 'all' | 'personalized' | 'none';
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
  captionUrl?: string | null;
  captionTracks?: { language: string; label: string; url: string }[] | null;
  durationSeconds?: number;
  videoType?: 'video' | 'short' | 'podcast';
  viewCount: number;
  likeCount: number;
  dislikeCount?: number;
  commentCount: number;
  skillTags: SkillTag[];
  categoryId?: string | null;
  createdAt: string;
  requiredTierId?: string | null;
  sourceStreamId?: string | null;
  publishedAt?: string | null;
  scheduledPublishAt?: string | null;
  failureReason?: string | null;
  transcodeProvider?: string | null;
  accessDenied?: boolean;
  accessReason?: string;
  viewerLiked?: boolean;
  viewerDisliked?: boolean;
  viewerFollowingCreator?: boolean;
  viewerSubscribed?: boolean;
  /** Resume position when returned from continue-watching / incomplete history. */
  viewerProgressSeconds?: number;
  /** Owner/admin — `held` means content scan / safety review. */
  moderationStatus?: 'none' | 'held' | 'blocked';
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
  chatMode?: 'all' | 'followers' | 'subscribers' | 'mods_only';
  recordEnabled?: boolean;
  ageRestricted?: boolean;
  requiredTierId?: string | null;
  accessDenied?: boolean;
  accessReason?: string;
  slowModeSeconds?: number;
  scheduledAt?: string | null;
  ticketPriceCents?: number | null;
  pinnedMessageId?: string | null;
  viewerCount: number;
  uniqueViewerCount?: number;
  dvrEnabled?: boolean;
  startedAt?: string;
  endedAt?: string;
  endReason?: 'host_ended' | 'connection_lost' | null;
  reconnecting?: boolean;
  reconnectDeadline?: string | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  userId: string;
  user?: User;
  videoId: string;
  content: string;
  parentId?: string;
  likeCount: number;
  replyCount?: number;
  isPinned?: boolean;
  creatorHearted?: boolean;
  viewerLiked?: boolean;
  viewerDisliked?: boolean;
  createdAt: string;
  /** Soft-deleted but kept in the thread because it still has live replies — render as a tombstone, not the real content/author. */
  isDeleted?: boolean;
  /** Present for video owners / admins — `held` means auto-flagged pending release. */
  moderationStatus?: 'none' | 'held' | 'blocked';
}

export type NotificationType =
  | 'creator_approved'
  | 'creator_rejected'
  | 'video_ready'
  | 'stream_started'
  | 'stream_started_followed'
  | 'premium_content_new'
  | 'subscription_expiring'
  | 'comment_on_video'
  | 'comment_reply'
  | 'new_follower'
  | 'video_liked'
  | 'direct_message'
  | 'community_role_assigned'
  | 'community_banned'
  | 'community_post_new'
  | 'achievement_unlocked'
  | 'xp_level_up'
  | 'super_thanks'
  | 'copyright_takedown'
  | 'copyright_video_reinstated'
  | 'strike_issued'
  | 'strike_rescinded'
  | 'strike_appeal_resolved'
  | 'content_scan_held';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
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
  description?: string | null;
  visibility?: 'public' | 'unlisted' | 'private';
  systemType?: 'watch_later' | 'liked' | null;
  /** Present on list endpoints (channel / library). */
  videoCount?: number;
  createdAt: string;
  updatedAt: string;
  items?: Array<{
    id: string;
    playlistId: string;
    videoId: string;
    position?: number;
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
