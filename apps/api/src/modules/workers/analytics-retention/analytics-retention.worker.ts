import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  ANALYTICS_RETENTION_QUEUE,
  AnalyticsRetentionJob,
} from '../../analytics/analytics-retention.constants';
import { AnalyticsRetentionService } from '../../analytics/analytics-retention.service';

@Processor(ANALYTICS_RETENTION_QUEUE)
export class AnalyticsRetentionWorker extends WorkerHost {
  private readonly logger = new Logger(AnalyticsRetentionWorker.name);

  constructor(private readonly retention: AnalyticsRetentionService) {
    super();
  }

  async process(_job: Job<AnalyticsRetentionJob>): Promise<void> {
    this.logger.debug('Running analytics retention');
    await this.retention.runRetention();
  }
}
