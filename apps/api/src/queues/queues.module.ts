import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { VIDEO_PROCESSING_QUEUE } from '../modules/content/video-processing.constants';
import { MUX_VOD_INGEST_QUEUE } from '../modules/content/mux-vod.constants';
import { ANALYTICS_INGEST_QUEUE } from '../modules/analytics/analytics-ingest.constants';
import { ANALYTICS_RETENTION_QUEUE } from '../modules/analytics/analytics-retention.constants';
import { PUSH_DISPATCH_QUEUE } from '../modules/notifications/push-dispatch.constants';
import { SUBSCRIPTION_MAINTENANCE_QUEUE } from '../modules/notifications/subscription-maintenance.constants';
import { ENGAGEMENT_RECONCILIATION_QUEUE } from '../modules/engagement/engagement-reconciliation.constants';
import { STREAM_REMINDER_QUEUE } from '../modules/workers/stream-reminder/stream-reminder.constants';
import { STREAM_CHAT_INGEST_QUEUE } from '../modules/workers/stream-chat-ingest/stream-chat-ingest.constants';
import { STREAM_SNAPSHOT_RETENTION_QUEUE } from '../modules/workers/stream-snapshot-retention/stream-snapshot-retention.constants';

/**
 * Central BullMQ queue registration for the API process.
 * Feature modules and workers inject queues by name; do not re-register here from services.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: VIDEO_PROCESSING_QUEUE }),
    BullModule.registerQueue({
      name: MUX_VOD_INGEST_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnFail: { age: 7 * 24 * 3600 },
        removeOnComplete: { age: 24 * 3600, count: 500 },
      },
    }),
    BullModule.registerQueue({
      name: ANALYTICS_INGEST_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 86400, count: 10000 },
      },
    }),
    BullModule.registerQueue({ name: PUSH_DISPATCH_QUEUE }),
    BullModule.registerQueue({
      name: SUBSCRIPTION_MAINTENANCE_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 86400, count: 48 },
        removeOnFail: { age: 7 * 86400, count: 100 },
      },
    }),
    BullModule.registerQueue({
      name: ENGAGEMENT_RECONCILIATION_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { age: 7 * 86400, count: 14 },
        removeOnFail: { age: 7 * 86400, count: 50 },
      },
    }),
    BullModule.registerQueue({
      name: STREAM_REMINDER_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { age: 3600, count: 100 },
      },
    }),
    BullModule.registerQueue({
      name: STREAM_CHAT_INGEST_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 3600, count: 10_000 },
        removeOnFail: { age: 86400, count: 5000 },
      },
    }),
    BullModule.registerQueue({
      name: STREAM_SNAPSHOT_RETENTION_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { age: 86400, count: 14 },
      },
    }),
    BullModule.registerQueue({
      name: ANALYTICS_RETENTION_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: { age: 7 * 86400, count: 14 },
        removeOnFail: { age: 7 * 86400, count: 50 },
      },
    }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
