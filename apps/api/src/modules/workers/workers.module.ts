import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { VideoProcessorWorker } from './video-processor/video-processor.worker';
import { Video } from '../content/entities/video.entity';
import { VIDEO_PROCESSING_QUEUE } from '../content/videos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video]),
    BullModule.registerQueue({ name: VIDEO_PROCESSING_QUEUE }),
    EventEmitterModule,
  ],
  providers: [VideoProcessorWorker],
})
export class WorkersModule {}
