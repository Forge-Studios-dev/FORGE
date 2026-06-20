import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  COMMUNITY_MODERATION_QUEUE,
  CommunityModerationJobData,
} from '../workers/community-moderation/community-moderation.constants';

@Injectable()
export class CommunityModerationQueueService {
  constructor(
    @InjectQueue(COMMUNITY_MODERATION_QUEUE)
    private readonly queue: Queue<CommunityModerationJobData>,
  ) {}

  async enqueueFlaggedMessage(data: CommunityModerationJobData): Promise<void> {
    await this.queue.add('review-flagged', data, {
      jobId: `mod:${data.channelId}:${data.userId}:${Date.now()}`,
      removeOnComplete: { age: 86400, count: 5000 },
    });
  }
}
