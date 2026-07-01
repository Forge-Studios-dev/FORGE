export const COMMUNITY_MODERATION_QUEUE = 'community-moderation';

export type CommunityModerationJobData = {
  communityId: string;
  channelId: string;
  userId: string;
  messageBody: string;
  score: number;
  reasons: string[];
  /** Posted message id when flagged by the async LLM tail (message already sent). */
  messageId?: string;
  /** Detection origin: 'fast_path' (sync block) or 'llm_tail' (async judge). */
  detectedBy?: 'fast_path' | 'llm_tail';
  /** UGC surface the flag originated from. `channelId` carries the surface id. */
  surface?: 'room' | 'post_comment';
};
