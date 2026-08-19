import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  COMMUNITY_MODERATION_QUEUE,
  CommunityModerationJobData,
} from '../workers/community-moderation/community-moderation.constants';
import { AiCommunityService } from './ai-community.service';

@Injectable()
export class CommunityModerationQueueService {
  constructor(
    @InjectQueue(COMMUNITY_MODERATION_QUEUE)
    private readonly queue: Queue<CommunityModerationJobData>,
    private readonly aiCommunityService: AiCommunityService,
    private readonly configService: ConfigService,
  ) {}

  async enqueueFlaggedMessage(data: CommunityModerationJobData): Promise<void> {
    await this.queue.add('review-flagged', data, {
      jobId: `mod:${data.channelId}:${data.userId}:${Date.now()}`,
      removeOnComplete: { age: 86400, count: 5000 },
    });
  }

  /**
   * Async LLM judge tail (AI-LLM-STRATEGY Phase I) shared by all UGC surfaces
   * (room messages, post comments). Runs only on borderline content that passed
   * the cheap sync fast path, when LLM moderation is enabled and within the daily
   * budget (enforced inside AiModerationService). The content is already persisted;
   * a confirmed flag enqueues it for moderator review. Fire-and-forget — never
   * blocks or fails the caller's write path.
   */
  maybeQueueLlmTail(input: {
    communityId: string;
    surface: 'room' | 'post_comment';
    surfaceId: string;
    userId: string;
    messageId: string;
    body: string;
    fastPathScore: number;
  }): void {
    if (!this.configService.get<boolean>('ai.moderationLlmEnabled')) return;
    if (!this.configService.get<string>('openai.apiKey')?.trim()) return;
    const reviewThreshold =
      this.configService.get<number>('ai.moderationReviewThreshold') ?? 0.25;
    if (input.fastPathScore < reviewThreshold) return;

    void (async () => {
      try {
        const verdict = await this.aiCommunityService.scoreContentAsync(input.body);
        // model !== 'llm' on borderline content means the LLM never actually
        // weighed in here (config gate above already confirmed it's enabled
        // and configured, so this is a runtime failure/budget skip, not "not
        // configured") — per ESCALATION_RULES.md, that must still reach a
        // human reviewer rather than being silently approved.
        const llmDelivered = verdict.model === 'llm';
        if (!verdict.flagged && llmDelivered) return;

        await this.enqueueFlaggedMessage({
          communityId: input.communityId,
          channelId: input.surfaceId,
          userId: input.userId,
          messageBody: input.body,
          score: verdict.score,
          reasons: llmDelivered ? verdict.reasons : ['ai_moderation_unavailable'],
          messageId: input.messageId,
          detectedBy: 'llm_tail',
          surface: input.surface,
          aiUnavailable: !llmDelivered,
        });
      } catch {
        // The tail itself threw (not just the LLM call) — same fail-safe:
        // still surface it for a human rather than silently dropping it.
        await this.enqueueFlaggedMessage({
          communityId: input.communityId,
          channelId: input.surfaceId,
          userId: input.userId,
          messageBody: input.body,
          score: input.fastPathScore,
          reasons: ['ai_moderation_unavailable'],
          messageId: input.messageId,
          detectedBy: 'llm_tail',
          surface: input.surface,
          aiUnavailable: true,
        }).catch(() => {
          // Queue itself is down — nothing more we can do from a fire-and-forget tail.
        });
      }
    })();
  }
}
