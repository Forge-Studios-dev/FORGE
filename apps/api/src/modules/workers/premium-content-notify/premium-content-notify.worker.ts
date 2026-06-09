import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PremiumContentNotifyService } from '../../notifications/premium-content-notify.service';
import {
  PREMIUM_CONTENT_NOTIFY_QUEUE,
  type PremiumContentNotifyJobData,
} from './premium-content-notify.constants';

@Processor(PREMIUM_CONTENT_NOTIFY_QUEUE)
export class PremiumContentNotifyWorker extends WorkerHost {
  private readonly logger = new Logger(PremiumContentNotifyWorker.name);

  constructor(private readonly premiumContentNotify: PremiumContentNotifyService) {
    super();
  }

  async process(job: Job<PremiumContentNotifyJobData>): Promise<void> {
    await this.premiumContentNotify.fanOut(job.data);
    this.logger.debug(`Premium content notify completed for video ${job.data.videoId}`);
  }
}
