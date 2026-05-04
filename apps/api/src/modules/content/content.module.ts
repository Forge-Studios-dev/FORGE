import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { VideosController } from './videos.controller';
import { VideosService, VIDEO_PROCESSING_QUEUE } from './videos.service';
import { Video } from './entities/video.entity';
import { SkillTag } from '../categories/entities/skill-tag.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video, SkillTag]),
    BullModule.registerQueue({ name: VIDEO_PROCESSING_QUEUE }),
  ],
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class ContentModule {}
