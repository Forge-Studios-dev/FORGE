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
    const { communityId, userId, messageBody, score, reasons, detectedBy, surface } = job.data;
    const via = detectedBy ?? 'fast_path';
    const on = surface ?? 'room';
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
