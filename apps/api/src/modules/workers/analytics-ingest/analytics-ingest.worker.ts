import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from '../../analytics/entities/analytics-event.entity';
import { ANALYTICS_INGEST_QUEUE } from '../../analytics/analytics-ingest.constants';

export type AnalyticsIngestJob = {
  eventName: string;
  properties: Record<string, unknown> | null;
  userId: string | null;
  videoId: string | null;
};

@Processor(ANALYTICS_INGEST_QUEUE, { concurrency: 5 })
export class AnalyticsIngestWorker extends WorkerHost {
  private readonly logger = new Logger(AnalyticsIngestWorker.name);

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsRepository: Repository<AnalyticsEvent>,
  ) {
    super();
  }

  async process(job: Job<AnalyticsIngestJob>): Promise<void> {
    const { eventName, properties, userId, videoId } = job.data;
    await this.analyticsRepository.save(
      this.analyticsRepository.create({
        eventName,
        properties,
        userId,
        videoId,
      }),
    );
  }
}
