import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoProcessorWorker } from './video-processor/video-processor.worker';
import { AnalyticsIngestWorker } from './analytics-ingest/analytics-ingest.worker';
import { Video } from '../content/entities/video.entity';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';
import { VIDEO_PROCESSING_QUEUE, VIDEO_PROCESSING_DLQ_QUEUE } from '../content/video-processing.constants';
import { MuxVodIngestWorker } from './mux-vod-ingest/mux-vod-ingest.worker';
import { MUX_VOD_INGEST_QUEUE } from '../content/mux-vod.constants';
import { ContentModule } from '../content/content.module';
import { ANALYTICS_INGEST_QUEUE } from '../analytics/analytics-ingest.constants';
import { PUSH_DISPATCH_QUEUE } from '../notifications/push-dispatch.constants';
import { SUBSCRIPTION_MAINTENANCE_QUEUE } from '../notifications/subscription-maintenance.constants';
import { ANALYTICS_RETENTION_QUEUE } from '../analytics/analytics-retention.constants';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PushDispatchWorker } from './push-dispatch/push-dispatch.worker';
import { SubscriptionMaintenanceWorker } from './subscription-maintenance/subscription-maintenance.worker';
import { AnalyticsRetentionWorker } from './analytics-retention/analytics-retention.worker';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeviceToken } from '../notifications/entities/device-token.entity';
import { FirebaseModule } from '../firebase/firebase.module';
import { StreamReminderWorker } from './stream-reminder/stream-reminder.worker';
import { STREAM_REMINDER_QUEUE } from './stream-reminder/stream-reminder.constants';
import { ScheduledPublishWorker } from './scheduled-publish/scheduled-publish.worker';
import { SCHEDULED_PUBLISH_QUEUE } from '../content/scheduled-publish.constants';
import { CopyrightReinstatementWorker } from './copyright-reinstatement/copyright-reinstatement.worker';
import { COPYRIGHT_REINSTATEMENT_QUEUE } from '../copyright/copyright-reinstatement.constants';
import { CopyrightModule } from '../copyright/copyright.module';
import { StreamChatIngestWorker } from './stream-chat-ingest/stream-chat-ingest.worker';
import { STREAM_CHAT_INGEST_QUEUE } from './stream-chat-ingest/stream-chat-ingest.constants';
import { StreamSnapshotRetentionWorker } from './stream-snapshot-retention/stream-snapshot-retention.worker';
import { STREAM_SNAPSHOT_RETENTION_QUEUE } from './stream-snapshot-retention/stream-snapshot-retention.constants';
import { StreamMuxSyncWorker } from './stream-mux-sync/stream-mux-sync.worker';
import { STREAM_MUX_SYNC_QUEUE } from './stream-mux-sync/stream-mux-sync.constants';
import { StreamingModule } from '../streaming/streaming.module';
import { Stream } from '../streaming/entities/stream.entity';
import { StreamMessage } from '../stream-chat/entities/stream-message.entity';
import { StreamAnalyticsSnapshot } from '../streaming/entities/stream-analytics-snapshot.entity';
import { StreamRsvp } from '../streaming/entities/stream-rsvp.entity';
import { PremiumContentNotifyWorker } from './premium-content-notify/premium-content-notify.worker';
import { PREMIUM_CONTENT_NOTIFY_QUEUE } from './premium-content-notify/premium-content-notify.constants';
import { CommunityAnnouncementNotifyWorker } from './community-announcement-notify/community-announcement-notify.worker';
import { COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE } from './community-announcement-notify/community-announcement-notify.constants';
import { CommunityModerationWorker } from './community-moderation/community-moderation.worker';
import { COMMUNITY_MODERATION_QUEUE } from './community-moderation/community-moderation.constants';
import { CommunitiesModule } from '../communities/communities.module';
import { ENGAGEMENT_RECONCILIATION_QUEUE } from '../engagement/engagement-reconciliation.constants';
import { EngagementReconciliationWorker } from './engagement-reconciliation/engagement-reconciliation.worker';
import { EngagementModule } from '../engagement/engagement.module';
import { PlatformEventOutboxWorker } from './platform-event-outbox/platform-event-outbox.worker';
import { PLATFORM_EVENT_OUTBOX_QUEUE } from './platform-event-outbox/platform-event-outbox.constants';
import { PlatformEventOutboxModule } from '../platform-event-outbox/platform-event-outbox.module';
import { EmailDigestWorker } from './email-digest/email-digest.worker';
import { EMAIL_DIGEST_QUEUE } from '../notifications/email-digest.constants';

function isDedicatedWorkerProcess(): boolean {
  return (
    process.env.WORKER_ONLY === 'true' || process.env.ENABLE_VIDEO_WORKER === 'true'
  );
}

function transcodeProvider(): string {
  return (process.env.VIDEO_TRANSCODE_PROVIDER || 'mux').toLowerCase();
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

function shouldRegisterAnalyticsRetention(): boolean {
  if (process.env.DISABLE_ANALYTICS_RETENTION === 'true') return false;
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

function shouldRegisterStreamReminder(): boolean {
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

function shouldRegisterScheduledPublish(): boolean {
  if (process.env.DISABLE_SCHEDULED_PUBLISH === 'true') return false;
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

function shouldRegisterCopyrightReinstatement(): boolean {
  if (process.env.DISABLE_COPYRIGHT_REINSTATEMENT === 'true') return false;
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

function shouldRegisterStreamChatIngest(): boolean {
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

function shouldRegisterStreamSnapshotRetention(): boolean {
  if (process.env.DISABLE_STREAM_SNAPSHOT_RETENTION === 'true') return false;
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

function shouldRegisterStreamMuxSync(): boolean {
  if (process.env.DISABLE_STREAM_MUX_SYNC === 'true') return false;
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

function shouldRegisterPremiumContentNotify(): boolean {
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

function shouldRegisterCommunityAnnouncementNotify(): boolean {
  // Production: Fly worker (WORKER_ONLY=true) must consume this queue; API enqueues only.
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

function shouldRegisterEngagementReconciliation(): boolean {
  if (process.env.DISABLE_ENGAGEMENT_RECONCILIATION === 'true') return false;
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

function shouldRegisterCommunityModeration(): boolean {
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

function shouldRegisterPlatformEventOutbox(): boolean {
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

function shouldRegisterEmailDigest(): boolean {
  if (process.env.DISABLE_EMAIL_DIGEST === 'true') return false;
  if (isDedicatedWorkerProcess()) return true;
  return process.env.NODE_ENV !== 'production';
}

@Module({
  imports: [
    AnalyticsModule,
    NotificationsModule,
    ContentModule,
    CopyrightModule,
    FirebaseModule,
    StreamingModule,
    EngagementModule,
    CommunitiesModule,
    TypeOrmModule.forFeature([Video, AnalyticsEvent, DeviceToken, Stream, StreamMessage, StreamAnalyticsSnapshot, StreamRsvp]),
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
    BullModule.registerQueue({
      name: ANALYTICS_RETENTION_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: { age: 7 * 86400, count: 14 },
        removeOnFail: { age: 7 * 86400, count: 50 },
      },
    }),
    BullModule.registerQueue({
      name: STREAM_REMINDER_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86400, count: 50 },
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
      name: COPYRIGHT_REINSTATEMENT_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { age: 7 * 86400, count: 50 },
        removeOnFail: { age: 7 * 86400, count: 50 },
      },
    }),
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
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: { age: 86400, count: 14 },
        removeOnFail: { age: 7 * 86400, count: 50 },
      },
    }),
    BullModule.registerQueue({
      name: STREAM_MUX_SYNC_QUEUE,
      defaultJobOptions: {
        attempts: 1,
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
      name: COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 86400, count: 500 },
      },
    }),
    BullModule.registerQueue({
      name: ENGAGEMENT_RECONCILIATION_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: { age: 7 * 86400, count: 14 },
        removeOnFail: { age: 7 * 86400, count: 50 },
      },
    }),
    BullModule.registerQueue({
      name: COMMUNITY_MODERATION_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 86400, count: 5000 },
        removeOnFail: { age: 86400, count: 500 },
      },
    }),
    BullModule.registerQueue({
      name: PLATFORM_EVENT_OUTBOX_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 86400, count: 500 },
      },
    }),
    BullModule.registerQueue({
      name: EMAIL_DIGEST_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: { age: 7 * 86400, count: 30 },
        removeOnFail: { age: 30 * 86400, count: 100 },
      },
    }),
    PlatformEventOutboxModule,
  ],
  providers: [
    ...(shouldRegisterAnalyticsIngest() ? [AnalyticsIngestWorker] : []),
    ...(shouldRegisterVideoProcessor() ? [VideoProcessorWorker] : []),
    ...(shouldRegisterMuxVodIngest() ? [MuxVodIngestWorker] : []),
    ...(shouldRegisterPushDispatch() ? [PushDispatchWorker] : []),
    ...(shouldRegisterSubscriptionMaintenance() ? [SubscriptionMaintenanceWorker] : []),
    ...(shouldRegisterAnalyticsRetention() ? [AnalyticsRetentionWorker] : []),
    ...(shouldRegisterStreamReminder() ? [StreamReminderWorker] : []),
    ...(shouldRegisterScheduledPublish() ? [ScheduledPublishWorker] : []),
    ...(shouldRegisterCopyrightReinstatement() ? [CopyrightReinstatementWorker] : []),
    ...(shouldRegisterStreamChatIngest() ? [StreamChatIngestWorker] : []),
    ...(shouldRegisterStreamSnapshotRetention() ? [StreamSnapshotRetentionWorker] : []),
    ...(shouldRegisterStreamMuxSync() ? [StreamMuxSyncWorker] : []),
    ...(shouldRegisterPremiumContentNotify() ? [PremiumContentNotifyWorker] : []),
    ...(shouldRegisterCommunityAnnouncementNotify() ? [CommunityAnnouncementNotifyWorker] : []),
    ...(shouldRegisterCommunityModeration() ? [CommunityModerationWorker] : []),
    ...(shouldRegisterPlatformEventOutbox() ? [PlatformEventOutboxWorker] : []),
    ...(shouldRegisterEngagementReconciliation() ? [EngagementReconciliationWorker] : []),
    ...(shouldRegisterEmailDigest() ? [EmailDigestWorker] : []),
  ],
})
export class WorkersModule {}
