import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { VideoProcessorWorker } from './video-processor/video-processor.worker';
import { AnalyticsIngestWorker } from './analytics-ingest/analytics-ingest.worker';
import { Video } from '../content/entities/video.entity';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';
import { VIDEO_PROCESSING_QUEUE, VIDEO_PROCESSING_DLQ_QUEUE } from '../content/videos.service';
import { MuxVodIngestWorker } from './mux-vod-ingest/mux-vod-ingest.worker';
import { MUX_VOD_INGEST_QUEUE } from '../content/mux-vod.constants';
import { ContentModule } from '../content/content.module';
import { ANALYTICS_INGEST_QUEUE } from '../analytics/analytics-ingest.constants';
import { PUSH_DISPATCH_QUEUE } from '../notifications/push-dispatch.constants';
import { SUBSCRIPTION_MAINTENANCE_QUEUE } from '../notifications/subscription-maintenance.constants';
import { PushDispatchWorker } from './push-dispatch/push-dispatch.worker';
import { SubscriptionMaintenanceWorker } from './subscription-maintenance/subscription-maintenance.worker';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeviceToken } from '../notifications/entities/device-token.entity';
import { FirebaseModule } from '../firebase/firebase.module';

function isDedicatedWorkerProcess(): boolean {
  return (
    process.env.WORKER_ONLY === 'true' || process.env.ENABLE_VIDEO_WORKER === 'true'
  );
}

function transcodeProvider(): string {
  return (process.env.VIDEO_TRANSCODE_PROVIDER || 'ffmpeg').toLowerCase();
}

/** FFmpeg must not run on API replicas unless explicitly enabled (local dev). */
function shouldRegisterVideoProcessor(): boolean {
  if (!isDedicatedWorkerProcess()) return false;
  return transcodeProvider() !== 'mux';
}

function shouldRegisterMuxVodIngest(): boolean {
  if (transcodeProvider() !== 'mux') return false;
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

/** In production, only the Fly worker app consumes BullMQ jobs; API enqueues only. */
function shouldRegisterAnalyticsIngest(): boolean {
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

function shouldRegisterPushDispatch(): boolean {
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

function shouldRegisterSubscriptionMaintenance(): boolean {
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

@Module({
  imports: [
    NotificationsModule,
    ContentModule,
    FirebaseModule,
    TypeOrmModule.forFeature([Video, AnalyticsEvent, DeviceToken]),
    BullModule.registerQueue({
      name: VIDEO_PROCESSING_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnFail: { age: 7 * 24 * 3600 },
        removeOnComplete: { age: 24 * 3600, count: 500 },
      },
    }),
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
      name: VIDEO_PROCESSING_DLQ_QUEUE,
      defaultJobOptions: {
        removeOnComplete: { age: 30 * 24 * 3600, count: 5000 },
        removeOnFail: false,
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
    BullModule.registerQueue({
      name: PUSH_DISPATCH_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 86400, count: 5000 },
      },
    }),
    BullModule.registerQueue({
      name: SUBSCRIPTION_MAINTENANCE_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 86400, count: 48 },
        removeOnFail: { age: 7 * 86400, count: 100 },
      },
    }),
    EventEmitterModule,
  ],
  providers: [
    ...(shouldRegisterAnalyticsIngest() ? [AnalyticsIngestWorker] : []),
    ...(shouldRegisterVideoProcessor() ? [VideoProcessorWorker] : []),
    ...(shouldRegisterMuxVodIngest() ? [MuxVodIngestWorker] : []),
    ...(shouldRegisterPushDispatch() ? [PushDispatchWorker] : []),
    ...(shouldRegisterSubscriptionMaintenance() ? [SubscriptionMaintenanceWorker] : []),
  ],
})
export class WorkersModule {}
