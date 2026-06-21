import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Community } from './entities/community.entity';
import { Channel } from './entities/channel.entity';
import { ChannelMember } from './entities/channel-member.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { Brand } from './entities/brand.entity';
import { CommunityCategory } from './entities/community-category.entity';
import { CommunityRole } from './entities/community-role.entity';
import { CommunityMemberBan, CommunityReport } from './entities/community-moderation.entity';
import { CommunitiesService } from './communities.service';
import { CommunityModerationService } from './community-moderation.service';
import { CommunitiesController } from './communities.controller';
import { CommunityModerationController } from './community-moderation.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { AccessSessionsModule } from '../access-sessions/access-sessions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { CommunityPost } from './entities/community-post.entity';
import { CommunityPostComment } from './entities/community-post-comment.entity';
import { CommunityPostReaction } from './entities/community-post-reaction.entity';
import { CommunityPoll } from './entities/community-poll.entity';
import { CommunityPollVote } from './entities/community-poll-vote.entity';
import {
  CommunityChallenge,
  CommunityChallengeParticipant,
  CommunitySurvey,
  CommunitySurveyResponse,
  CommunityWikiPage,
} from './entities/community-engagement.entity';
import { CommunityPostsService } from './community-posts.service';
import { CommunityPostsController } from './community-posts.controller';
import { CommunityPollsService } from './community-polls.service';
import { CommunityPollsController } from './community-polls.controller';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { AiModerationService } from './ai-moderation.service';
import { AiCommunityService } from './ai-community.service';
import { CreatorAuditService } from './creator-audit.service';
import { CommunityRoleGuard } from './guards/community-role.guard';
import { COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE } from '../workers/community-announcement-notify/community-announcement-notify.constants';
import { COMMUNITY_MODERATION_QUEUE } from '../workers/community-moderation/community-moderation.constants';
import { CommunityModerationQueueService } from './community-moderation-queue.service';
import { CommunityEngagementService } from './community-engagement.service';
import { CommunityEngagementController } from './community-engagement.controller';
import { CommunityRoom } from './entities/community-room.entity';
import { CommunityRoomMessage, CommunityRoomPermissionRow, CreatorAuditLog } from './entities/community-room-message.entity';
import { CommunityRoomsService } from './community-rooms.service';
import { CommunityRoomMessagesService } from './community-room-messages.service';
import { CommunityRoomPermissionsService } from './community-room-permissions.service';
import { CommunityRoomsController } from './community-rooms.controller';
import { CommunityRoomLivekitService } from './community-room-livekit.service';
import { CommunityStorageService } from './community-storage.service';
import { CommunityAiController } from './community-ai.controller';
import { PlatformEventOutboxModule } from '../platform-event-outbox/platform-event-outbox.module';
import { Stream } from '../streaming/entities/stream.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Community,
      Channel,
      ChannelMember,
      ChannelMessage,
      Brand,
      CommunityCategory,
      CommunityRole,
      CommunityMemberBan,
      CommunityReport,
      CommunityPost,
      CommunityPostComment,
      CommunityPostReaction,
      CommunityPoll,
      CommunityPollVote,
      CommunityWikiPage,
      CommunityChallenge,
      CommunityChallengeParticipant,
      CommunitySurvey,
      CommunitySurveyResponse,
      Stream,
      CommunityRoom,
      CommunityRoomMessage,
      CommunityRoomPermissionRow,
      CreatorAuditLog,
    ]),
    EntitlementsModule,
    AccessSessionsModule,
    NotificationsModule,
    UsersModule,
    PlatformEventOutboxModule,
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
      name: COMMUNITY_MODERATION_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 86400, count: 5000 },
        removeOnFail: { age: 86400, count: 500 },
      },
    }),
  ],
  controllers: [
    CommunitiesController,
    CommunityModerationController,
    BrandsController,
    CommunityPostsController,
    CommunityPollsController,
    CommunityEngagementController,
    CommunityRoomsController,
    CommunityAiController,
  ],
  providers: [
    CommunitiesService,
    CommunityModerationService,
    BrandsService,
    CommunityPostsService,
    CommunityPollsService,
    CommunityEngagementService,
    CommunityRoomsService,
    CommunityRoomMessagesService,
    CommunityRoomPermissionsService,
    CommunityRoomLivekitService,
    CommunityStorageService,
    AiModerationService,
    AiCommunityService,
    CreatorAuditService,
    CommunityModerationQueueService,
    CreatorApprovedGuard,
    CommunityRoleGuard,
  ],
  exports: [CommunitiesService, CommunityModerationService],
})
export class CommunitiesModule {}
