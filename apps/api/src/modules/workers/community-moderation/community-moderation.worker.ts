import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  COMMUNITY_MODERATION_QUEUE,
  CommunityModerationJobData,
} from './community-moderation.constants';
import { CommunityModerationService } from '../../communities/community-moderation.service';

@Processor(COMMUNITY_MODERATION_QUEUE)
export class CommunityModerationWorker extends WorkerHost {
  private readonly logger = new Logger(CommunityModerationWorker.name);

  constructor(private readonly moderationService: CommunityModerationService) {
    super();
  }

  async process(job: Job<CommunityModerationJobData>): Promise<void> {
    const { communityId, userId, messageBody, score, reasons } = job.data;
    this.logger.log(
      `Moderation queue: community=${communityId} user=${userId} score=${score}`,
    );
    await this.moderationService.createAutoSpamReport({
      communityId,
      reportedUserId: userId,
      targetType: 'user',
      reason: `Auto-flagged spam (score=${score.toFixed(2)}): ${reasons.join(', ')} — "${messageBody.slice(0, 120)}"`,
    });
  }
}
