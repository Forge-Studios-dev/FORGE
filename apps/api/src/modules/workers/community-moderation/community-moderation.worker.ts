import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  COMMUNITY_MODERATION_QUEUE,
  CommunityModerationJobData,
} from './community-moderation.constants';
import { CommunityModerationService } from '../../communities/community-moderation.service';
import { CreatorCopilotService } from '../../communities/creator-copilot.service';

@Processor(COMMUNITY_MODERATION_QUEUE)
export class CommunityModerationWorker extends WorkerHost {
  private readonly logger = new Logger(CommunityModerationWorker.name);

  constructor(
    private readonly moderationService: CommunityModerationService,
    private readonly copilotService: CreatorCopilotService,
  ) {
    super();
  }

  async process(job: Job<CommunityModerationJobData>): Promise<void> {
    const { communityId, userId, messageBody, score, reasons, detectedBy, surface, aiUnavailable } =
      job.data;
    const via = detectedBy ?? 'fast_path';
    const on = surface ?? 'room';

    if (aiUnavailable) {
      // The LLM never delivered a verdict on this borderline content (budget
      // exhausted / API failure). Re-running judgeFlaggedContent here would
      // hit the exact same fail-open path and dismiss it again — go straight
      // to a human-reviewable report instead, per ESCALATION_RULES.md.
      this.logger.log(
        `Moderation queue: community=${communityId} user=${userId} surface=${on} via=${via} score=${score} judge=ai_unavailable`,
      );
      await this.moderationService.createAutoSpamReport({
        communityId,
        reportedUserId: userId,
        targetType: 'user',
        reason: `Needs manual review — AI moderation unavailable (fast-path score=${score.toFixed(2)}, surface=${on}): ${reasons.join(', ')} — "${messageBody.slice(0, 120)}"`,
      });
      return;
    }

    const judgment = await this.copilotService.judgeFlaggedContent(messageBody);
    if (!judgment.confirmed) {
      this.logger.debug(
        `Moderation queue dismissed: community=${communityId} user=${userId} surface=${on} via=${via} judge=${judgment.reason}`,
      );
      return;
    }
    this.logger.log(
      `Moderation queue: community=${communityId} user=${userId} surface=${on} via=${via} score=${score} judge=${judgment.score}`,
    );
    await this.moderationService.createAutoSpamReport({
      communityId,
      reportedUserId: userId,
      targetType: 'user',
      reason: `Auto-flagged spam (score=${score.toFixed(2)}, judge=${judgment.score.toFixed(2)}, surface=${on}, via=${via}): ${reasons.join(', ')} — "${messageBody.slice(0, 120)}"`,
    });
  }
}
