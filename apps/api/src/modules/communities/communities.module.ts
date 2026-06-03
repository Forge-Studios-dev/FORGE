import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Community } from './entities/community.entity';
import { Channel } from './entities/channel.entity';
import { ChannelMember } from './entities/channel-member.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { CommunitiesService } from './communities.service';
import { CommunitiesController } from './communities.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { UsersModule } from '../users/users.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Community, Channel, ChannelMember, ChannelMessage]),
    EntitlementsModule,
    UsersModule,
  ],
  controllers: [CommunitiesController],
  providers: [CommunitiesService, CreatorApprovedGuard],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
