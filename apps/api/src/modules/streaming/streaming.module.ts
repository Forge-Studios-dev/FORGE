import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { STREAM_REMINDER_QUEUE } from '../workers/stream-reminder/stream-reminder.constants';
import { STREAM_CHAT_INGEST_QUEUE } from '../workers/stream-chat-ingest/stream-chat-ingest.constants';
import { STREAM_SNAPSHOT_RETENTION_QUEUE } from '../workers/stream-snapshot-retention/stream-snapshot-retention.constants';
import { STREAM_MUX_SYNC_QUEUE } from '../workers/stream-mux-sync/stream-mux-sync.constants';
import { PREMIUM_CONTENT_NOTIFY_QUEUE } from '../workers/premium-content-notify/premium-content-notify.constants';
import { STREAM_CLIP_EXPORT_QUEUE } from '../workers/stream-clip-export/stream-clip-export.constants';
import { StreamClipExportService } from '../workers/stream-clip-export/stream-clip-export.service';
import { StreamReminderScheduler } from './stream-reminder.scheduler';
import { StreamSnapshotRetentionScheduler } from './stream-snapshot-retention.scheduler';
import { StreamMuxSyncScheduler } from './stream-mux-sync.scheduler';
import { StreamingController } from './streaming.controller';
import { StreamingService } from './streaming.service';
import { StreamLiveService } from './stream-live.service';
import { Stream } from './entities/stream.entity';
import { StreamEventPurchase } from './entities/stream-event-purchase.entity';
import { StreamAnalyticsSnapshot } from './entities/stream-analytics-snapshot.entity';
import { StreamModerator } from './entities/stream-moderator.entity';
import { StreamRsvp } from './entities/stream-rsvp.entity';
import { StreamPoll } from './entities/stream-poll.entity';
import { StreamPollVote } from './entities/stream-poll-vote.entity';
import { StreamClip } from './entities/stream-clip.entity';
import { StreamCaption } from './entities/stream-caption.entity';
import { StreamAudienceRequest } from './entities/stream-audience-request.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { UploadNotRestrictedGuard } from '../../common/guards/upload-not-restricted.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { Video } from '../content/entities/video.entity';
import { ContentModule } from '../content/content.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { BillingModule } from '../billing/billing.module';
import { AccessSessionsModule } from '../access-sessions/access-sessions.module';
import { WebhookIdempotencyModule } from '../../common/webhooks/webhook-idempotency.module';
import { CommunitiesModule } from '../communities/communities.module';
import { WebhookEvent } from './entities/webhook-event.entity';
import { StreamViewerService } from './stream-viewer.service';
import { StreamAnalyticsService } from './stream-analytics.service';
import { MuxLiveSyncService } from './mux-live-sync.service';
import { StreamReactionService } from './stream-reaction.service';
import { StreamAnalyticsController } from './stream-analytics.controller';
import { StreamMessage } from '../stream-chat/entities/stream-message.entity';
import { Community } from '../communities/entities/community.entity';
import { StreamBreakoutService } from './stream-breakout.service';
import { CommunityRoom } from '../communities/entities/community-room.entity';

import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: STREAM_REMINDER_QUEUE }),
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
      name: STREAM_MUX_SYNC_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { age: 3600, count: 500 },
        removeOnFail: { age: 86400, count: 200 },
      },
    }),
    BullModule.registerQueue({
      name: PREMIUM_CONTENT_NOTIFY_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 86400, count: 500 },
      },
    }),
    BullModule.registerQueue({
      name: STREAM_CLIP_EXPORT_QUEUE,
      defaultJobOptions: {
        attempts: 4,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400, count: 2000 },
        removeOnFail: { age: 7 * 86400, count: 500 },
      },
    }),
    WebhookIdempotencyModule,
    TypeOrmModule.forFeature([
      Stream,
      Video,
      User,
      StreamEventPurchase,
      StreamAnalyticsSnapshot,
      StreamMessage,
      WebhookEvent,
      StreamModerator,
      StreamRsvp,
      StreamPoll,
      StreamPollVote,
      StreamClip,
      StreamCaption,
      StreamAudienceRequest,
      Community,
      CommunityRoom,
    ]),
    forwardRef(() => UsersModule),
    forwardRef(() => EngagementModule),
    forwardRef(() => ContentModule),
    forwardRef(() => EntitlementsModule),
    forwardRef(() => AccessSessionsModule),
    forwardRef(() => BillingModule),
    forwardRef(() => CommunitiesModule),
  ],
  controllers: [StreamingController, StreamAnalyticsController],
  providers: [
    StreamingService,
    StreamLiveService,
    StreamViewerService,
    StreamAnalyticsService,
    MuxLiveSyncService,
    StreamClipExportService,
    StreamReminderScheduler,
    StreamSnapshotRetentionScheduler,
    StreamMuxSyncScheduler,
    StreamReactionService,
    StreamBreakoutService,
    CreatorApprovedGuard,
    UploadNotRestrictedGuard,
    OptionalJwtAuthGuard,
  ],
  exports: [
    StreamingService,
    StreamLiveService,
    StreamViewerService,
    StreamAnalyticsService,
    MuxLiveSyncService,
    StreamClipExportService,
    StreamMuxSyncScheduler,
    StreamReactionService,
  ],
})
export class StreamingModule {}
