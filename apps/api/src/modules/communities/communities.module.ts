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
import { CommunityPostsService } from './community-posts.service';
import { CommunityPostsController } from './community-posts.controller';
import { CommunityPollsService } from './community-polls.service';
import { CommunityPollsController } from './community-polls.controller';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { AiModerationService } from './ai-moderation.service';
import { CommunityRoleGuard } from './guards/community-role.guard';
import { COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE } from '../workers/community-announcement-notify/community-announcement-notify.constants';
import { COMMUNITY_MODERATION_QUEUE } from '../workers/community-moderation/community-moderation.constants';
import { CommunityModerationQueueService } from './community-moderation-queue.service';
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
      Stream,
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
  controllers: [CommunitiesController, CommunityModerationController, BrandsController, CommunityPostsController, CommunityPollsController],
  providers: [CommunitiesService, CommunityModerationService, BrandsService, CommunityPostsService, CommunityPollsService, AiModerationService, CommunityModerationQueueService, CreatorApprovedGuard, CommunityRoleGuard],
  exports: [CommunitiesService, CommunityModerationService],
})
export class CommunitiesModule {}
