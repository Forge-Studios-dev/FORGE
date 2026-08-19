import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CommunityAnnouncementNotifyService } from '../../notifications/community-announcement-notify.service';
import {
  COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE,
  type CommunityAnnouncementNotifyJobData,
} from './community-announcement-notify.constants';

@Processor(COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE)
export class CommunityAnnouncementNotifyWorker extends WorkerHost {
  private readonly logger = new Logger(CommunityAnnouncementNotifyWorker.name);

  constructor(private readonly announcementNotify: CommunityAnnouncementNotifyService) {
    super();
  }

  async process(job: Job<CommunityAnnouncementNotifyJobData>): Promise<void> {
    await this.announcementNotify.fanOut(job);
    this.logger.debug(`Community announcement notify completed for post ${job.data.postId}`);
  }
}
