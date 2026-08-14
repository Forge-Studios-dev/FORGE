import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  SCHEDULED_PUBLISH_QUEUE,
  ScheduledPublishJob,
} from '../../content/scheduled-publish.constants';
import { ScheduledPublishService } from '../../content/scheduled-publish.service';

@Processor(SCHEDULED_PUBLISH_QUEUE)
export class ScheduledPublishWorker extends WorkerHost {
  private readonly logger = new Logger(ScheduledPublishWorker.name);

  constructor(private readonly scheduledPublish: ScheduledPublishService) {
    super();
  }

  async process(_job: Job<ScheduledPublishJob>): Promise<void> {
    const { published } = await this.scheduledPublish.runScheduledPublish();
    if (published > 0) {
      this.logger.log(`Scheduled publish scan indexed ${published} video(s)`);
    }
  }
}
