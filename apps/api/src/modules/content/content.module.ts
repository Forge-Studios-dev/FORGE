import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { VIDEO_PROCESSING_QUEUE } from './video-processing.constants';
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
import { UploadNotRestrictedGuard } from '../../common/guards/upload-not-restricted.guard';
import { SkillEconomyLmsGuard } from '../../common/guards/skill-economy-lms.guard';
import { ViewCountFlushService } from './view-count-flush.service';
import { VideoMultipartService } from './video-multipart.service';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { EngagementModule } from '../engagement/engagement.module';
import { AccessSessionsModule } from '../access-sessions/access-sessions.module';
import { PodcastSeries } from './entities/podcast-series.entity';
import { PodcastsService } from './podcasts.service';
import { PodcastsController } from './podcasts.controller';
import { RecommendationsService } from './recommendations.service';
import { ContentLibraryService } from './content-library.service';
import { FeedModule } from '../feed/feed.module';
import { isSkillEconomyLmsEnabled } from '../../common/features/skill-economy-lms';
import { SCHEDULED_PUBLISH_QUEUE } from './scheduled-publish.constants';
import { ScheduledPublishService } from './scheduled-publish.service';
import { ScheduledPublishScheduler } from './scheduled-publish.scheduler';
import { ContentScanService } from './content-scan/content-scan.service';
import { SHORTS_WATCH_PERCENT_QUEUE } from './shorts-watch-percent.constants';
import { ShortsWatchPercentService } from './shorts-watch-percent.service';
import { ShortsWatchPercentScheduler } from './shorts-watch-percent.scheduler';

const skillEconomyLms = isSkillEconomyLmsEnabled();

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
      PodcastSeries,
    ]),
    forwardRef(() => UsersModule),
    forwardRef(() => EntitlementsModule),
    EngagementModule,
    forwardRef(() => AccessSessionsModule),
    // VideosController now serves FeedController's `feed`/`public`/`by-skills`
    // routes directly (route-shadow fix — see videos.controller.ts), which
    // means ContentModule needs FeedService. FeedModule already imports
    // ContentModule for VideosService, so this is a genuine cycle.
    forwardRef(() => FeedModule),
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
      name: SCHEDULED_PUBLISH_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { age: 3600, count: 50 },
        removeOnFail: { age: 3600, count: 50 },
      },
    }),
    BullModule.registerQueue({
      name: SHORTS_WATCH_PERCENT_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { age: 7 * 3600, count: 24 },
        removeOnFail: { age: 7 * 3600, count: 24 },
      },
    }),
  ],
  controllers: [VideosController, ...(skillEconomyLms ? [PodcastsController] : [])],
  providers: [
    VideosService,
    MuxVodService,
    CreatorApprovedGuard,
    UploadNotRestrictedGuard,
    SkillEconomyLmsGuard,
    ViewCountFlushService,
    VideoMultipartService,
    ...(skillEconomyLms ? [PodcastsService] : []),
    RecommendationsService,
    ContentLibraryService,
    ScheduledPublishService,
    ScheduledPublishScheduler,
    ContentScanService,
    ShortsWatchPercentService,
    ShortsWatchPercentScheduler,
  ],
  exports: [
    VideosService,
    MuxVodService,
    ...(skillEconomyLms ? [PodcastsService] : []),
    RecommendationsService,
    ContentLibraryService,
    ScheduledPublishService,
    ContentScanService,
    ShortsWatchPercentService,
  ],
})
export class ContentModule {}
