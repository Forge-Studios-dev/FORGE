import { DynamicModule, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChannelPointRedemption,
  ChannelPointReward,
  ChannelPointsBalance,
} from './entities/channel-points.entity';
import { ChannelPointsService } from './channel-points.service';
import { ChannelPointsController } from './channel-points.controller';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { UsersModule } from '../users/users.module';
import { EngagementModule } from '../engagement/engagement.module';
import { isSkillEconomyLmsEnabled } from '../../common/features/skill-economy-lms';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

/**
 * Channel points (skill-economy). Controllers only register when
 * FEATURES_SKILL_ECONOMY_LMS=true (YouTube mode leaves this empty).
 */
@Module({})
export class ChannelPointsModule {
  static register(): DynamicModule {
    if (!isSkillEconomyLmsEnabled()) {
      return { module: ChannelPointsModule };
    }

    return {
      module: ChannelPointsModule,
      imports: [
        TypeOrmModule.forFeature([
          ChannelPointsBalance,
          ChannelPointReward,
          ChannelPointRedemption,
        ]),
        forwardRef(() => UsersModule),
        forwardRef(() => EngagementModule),
      ],
      providers: [ChannelPointsService, CreatorApprovedGuard, OptionalJwtAuthGuard],
      controllers: [ChannelPointsController],
      exports: [ChannelPointsService],
    };
  }
}
