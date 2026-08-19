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
  /**
   * Set when this job was queued because the LLM never actually delivered a
   * verdict (budget exhausted / API error / timeout) on borderline content,
   * per ESCALATION_RULES.md's "budget exhausted or both providers fail ->
   * approve optimistically, queue for async human review". The worker must
   * NOT re-run its own LLM judge step for these (same failure mode would
   * fail-open again) — go straight to a human-reviewable report instead.
   */
  aiUnavailable?: boolean;
};
