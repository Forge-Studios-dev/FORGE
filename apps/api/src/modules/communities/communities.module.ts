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
import { PlatformModule } from '../platform/platform.module';
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
import { AiBudgetService } from './ai-budget.service';
import { CreatorAuditService } from './creator-audit.service';
import { CommunityRoleGuard } from './guards/community-role.guard';
import { CommunityStudioGuard } from './guards/community-studio.guard';
import { COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE } from '../workers/community-announcement-notify/community-announcement-notify.constants';
import { COMMUNITY_MODERATION_QUEUE } from '../workers/community-moderation/community-moderation.constants';
import { CommunityModerationQueueService } from './community-moderation-queue.service';
import { CommunityEngagementService } from './community-engagement.service';
import { CommunityEngagementController } from './community-engagement.controller';
import { CommunityRoom } from './entities/community-room.entity';
import { ChannelRoomMapping } from './entities/channel-room-mapping.entity';
import { CommunityEvent, CommunityEventRsvp } from './entities/community-event.entity';
import { CommunityMember } from './entities/community-member.entity';
import { CommunityRoomMessage, CommunityRoomPermissionRow, CreatorAuditLog } from './entities/community-room-message.entity';
import { CommunityRoomsService } from './community-rooms.service';
import { CommunityRoomMessagesService } from './community-room-messages.service';
import { CommunityRoomPermissionsService } from './community-room-permissions.service';
import { CommunityRoomsController } from './community-rooms.controller';
import { CommunityRoomLivekitService } from './community-room-livekit.service';
import { CommunityStorageService } from './community-storage.service';
import { CommunityMembersService } from './community-members.service';
import { CommunityMembersController } from './community-members.controller';
import { ChannelMigrationService } from './channel-migration.service';
import { CommunityEventsService } from './community-events.service';
import { CommunityEventsController } from './community-events.controller';
import { CommunityActivityNotifyListener } from './community-activity-notify.listener';
import { AfterLiveRoomListener } from './after-live-room.listener';
import { CommunityAccessListener } from './community-access.listener';
import { CreatorCopilotService } from './creator-copilot.service';
import { LlmRouterService } from './llm-router.service';
import { CommunityAiController } from './community-ai.controller';
import { PlatformEventOutboxModule } from '../platform-event-outbox/platform-event-outbox.module';
import { DeprecatedChannelApiInterceptor } from '../../common/interceptors/deprecated-channel-api.interceptor';
import { Stream } from '../streaming/entities/stream.entity';
import { CommunityGroup, CommunityGroupMember } from './entities/community-group.entity';
import { CommunityGroupsService } from './community-groups.service';
import { CommunityGroupsController } from './community-groups.controller';
import { MentorshipMatch, MentorshipProfile } from './entities/mentorship.entity';
import { MentorshipService } from './mentorship.service';
import { MentorshipController } from './mentorship.controller';

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
      CommunityMember,
      CommunityRoomMessage,
      CommunityRoomPermissionRow,
      CreatorAuditLog,
      ChannelRoomMapping,
      CommunityEvent,
      CommunityEventRsvp,
      CommunityGroup,
      CommunityGroupMember,
      MentorshipProfile,
      MentorshipMatch,
    ]),
    EntitlementsModule,
    AccessSessionsModule,
    NotificationsModule,
    UsersModule,
    PlatformModule,
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
    CommunityMembersController,
    CommunityEventsController,
    CommunityGroupsController,
    MentorshipController,
  ],
  providers: [
    CommunitiesService,
    DeprecatedChannelApiInterceptor,
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
    AiBudgetService,
    CreatorAuditService,
    CommunityModerationQueueService,
    CommunityMembersService,
    CommunityAccessListener,
    CreatorCopilotService,
    LlmRouterService,
    ChannelMigrationService,
    CommunityEventsService,
    CommunityActivityNotifyListener,
    AfterLiveRoomListener,
    CreatorApprovedGuard,
    CommunityRoleGuard,
    CommunityStudioGuard,
    CommunityGroupsService,
    MentorshipService,
  ],
  exports: [
    CommunitiesService,
    CommunityModerationService,
    CommunityRoomsService,
    CreatorCopilotService,
    LlmRouterService,
    CommunityMembersService,
    AiCommunityService,
  ],})
export class CommunitiesModule {}
