export const COMMUNITY_MODERATION_QUEUE = 'community-moderation';

export type CommunityModerationJobData = {
  communityId: string;
  channelId: string;
  userId: string;
  messageBody: string;
  score: number;
  reasons: string[];
};
