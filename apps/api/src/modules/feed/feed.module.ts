import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { Video } from '../content/entities/video.entity';
import { FeedListener } from './feed.listener';

@Module({
  imports: [TypeOrmModule.forFeature([Video])],
  controllers: [FeedController],
  providers: [FeedService, FeedListener],
  exports: [FeedService],
})
export class FeedModule {}
