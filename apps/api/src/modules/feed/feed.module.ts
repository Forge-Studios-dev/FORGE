import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { Video } from '../content/entities/video.entity';
import { Follow } from '../engagement/entities/follow.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { FeedListener } from './feed.listener';
import { Category } from '../categories/entities/category.entity';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video, Follow, WatchHistory, Category]),
    ContentModule,
  ],
  controllers: [FeedController],
  providers: [FeedService, FeedListener],
  exports: [FeedService],
})
export class FeedModule {}
