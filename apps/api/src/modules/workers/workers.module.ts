import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { VideoProcessorWorker } from './video-processor/video-processor.worker';
import { Video } from '../content/entities/video.entity';
import { VIDEO_PROCESSING_QUEUE, VIDEO_PROCESSING_DLQ_QUEUE } from '../content/videos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video]),
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
    EventEmitterModule,
  ],
  providers: [VideoProcessorWorker],
})
export class WorkersModule {}
