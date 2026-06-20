export type Community = {
  id: string;
  name: string;
  slug: string;
  visibility: string;
  brandId?: string | null;
  creatorId?: string;
};

export type CommunityCategory = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

export type ChannelAccess = { allowed: boolean; reason?: string | null };

export type CommunityChannel = {
  id: string;
  name: string;
  slug: string;
  type: string;
  categoryId?: string | null;
  requiredTierId?: string | null;
  access?: ChannelAccess;
};

export type CommunityPost = {
  id: string;
  title?: string | null;
  body: string;
  postType: string;
  isPinned: boolean;
  mediaUrls?: string[];
  author?: { displayName?: string; username?: string };
  createdAt?: string;
};

export type CommunityPoll = {
  id: string;
  question: string;
  options: string[];
  counts: number[];
  totalVotes: number;
  isActive: boolean;
  myOptionIndex?: number | null;
};

export type CommunityPayload = {
  community: Community | null;
  categories: CommunityCategory[];
  channels: CommunityChannel[];
};

export type Brand = {
  id: string;
  name: string;
  slug: string;
};

export type SubscriberRow = {
  userId: string;
  username?: string;
  displayName?: string;
};
