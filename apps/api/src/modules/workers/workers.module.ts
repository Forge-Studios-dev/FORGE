import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { VideoProcessorWorker } from './video-processor/video-processor.worker';
import { AnalyticsIngestWorker } from './analytics-ingest/analytics-ingest.worker';
import { Video } from '../content/entities/video.entity';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';
import { VIDEO_PROCESSING_QUEUE, VIDEO_PROCESSING_DLQ_QUEUE } from '../content/videos.service';
import { ANALYTICS_INGEST_QUEUE } from '../analytics/analytics-ingest.constants';
import { PUSH_DISPATCH_QUEUE } from '../notifications/push-dispatch.constants';
import { PushDispatchWorker } from './push-dispatch/push-dispatch.worker';
import { DeviceToken } from '../notifications/entities/device-token.entity';
import { FirebaseModule } from '../firebase/firebase.module';

function isDedicatedWorkerProcess(): boolean {
  return (
    process.env.WORKER_ONLY === 'true' || process.env.ENABLE_VIDEO_WORKER === 'true'
  );
}

/** FFmpeg must not run on API replicas unless explicitly enabled (local dev). */
function shouldRegisterVideoProcessor(): boolean {
  return isDedicatedWorkerProcess();
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

@Module({
  imports: [
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
    EventEmitterModule,
  ],
  providers: [
    ...(shouldRegisterAnalyticsIngest() ? [AnalyticsIngestWorker] : []),
    ...(shouldRegisterVideoProcessor() ? [VideoProcessorWorker] : []),
    ...(shouldRegisterPushDispatch() ? [PushDispatchWorker] : []),
  ],
})
export class WorkersModule {}
