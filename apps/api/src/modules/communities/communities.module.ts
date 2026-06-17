import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { UsersModule } from '../users/users.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { CommunityPost } from './entities/community-post.entity';
import { CommunityPostsService } from './community-posts.service';
import { CommunityPostsController } from './community-posts.controller';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { AiModerationService } from './ai-moderation.service';
import { CommunityRoleGuard } from './guards/community-role.guard';

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
    ]),
    EntitlementsModule,
    AccessSessionsModule,
    UsersModule,
  ],
  controllers: [CommunitiesController, CommunityModerationController, BrandsController, CommunityPostsController],
  providers: [CommunitiesService, CommunityModerationService, BrandsService, CommunityPostsService, AiModerationService, CreatorApprovedGuard, CommunityRoleGuard],
  exports: [CommunitiesService, CommunityModerationService],
})
export class CommunitiesModule {}
