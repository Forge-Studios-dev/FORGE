import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { VideosController } from './videos.controller';
import { VideosService, VIDEO_PROCESSING_QUEUE } from './videos.service';
import { MUX_VOD_INGEST_QUEUE } from './mux-vod.constants';
import { MuxVodService } from './mux-vod.service';
import { Video } from './entities/video.entity';
import { VideoMultipartSession } from './entities/video-multipart-session.entity';
import { SkillTag } from '../categories/entities/skill-tag.entity';
import { Category } from '../categories/entities/category.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { Playlist } from '../playlists/entities/playlist.entity';
import { PlaylistVideo } from '../playlists/entities/playlist-video.entity';
import { UsersModule } from '../users/users.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { ViewCountFlushService } from './view-count-flush.service';
import { VideoMultipartService } from './video-multipart.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Video,
      VideoMultipartSession,
      SkillTag,
      Category,
      WatchHistory,
      Playlist,
      PlaylistVideo,
    ]),
    forwardRef(() => UsersModule),
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
  ],
  controllers: [VideosController],
  providers: [
    VideosService,
    MuxVodService,
    CreatorApprovedGuard,
    ViewCountFlushService,
    VideoMultipartService,
  ],
  exports: [VideosService, MuxVodService],
})
export class ContentModule {}
