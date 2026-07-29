import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PlatformEventOutboxService } from '../../platform-event-outbox/platform-event-outbox.service';
import {
  PLATFORM_EVENT_OUTBOX_QUEUE,
  type PlatformEventOutboxJobData,
} from './platform-event-outbox.constants';

@Processor(PLATFORM_EVENT_OUTBOX_QUEUE, { concurrency: 2 })
export class PlatformEventOutboxWorker extends WorkerHost {
  private readonly logger = new Logger(PlatformEventOutboxWorker.name);

  constructor(private readonly outboxService: PlatformEventOutboxService) {
    super();
  }

  async process(job: Job<PlatformEventOutboxJobData>): Promise<void> {
    await this.outboxService.dispatchEvent(job.data.eventId);
    this.logger.debug(`Outbox event ${job.data.eventId} dispatched`);
  }
}
