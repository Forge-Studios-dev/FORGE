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
import { isChannelPointsEnabled } from '../../common/features/skill-platform';
import { SkillFeatureGuard } from '../../common/guards/skill-feature.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

/**
 * Channel points. Registers when FEATURES_CHANNEL_POINTS=true or full LMS flag.
 */
@Module({})
export class ChannelPointsModule {
  static register(): DynamicModule {
    if (!isChannelPointsEnabled()) {
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
      providers: [
        ChannelPointsService,
        CreatorApprovedGuard,
        OptionalJwtAuthGuard,
        SkillFeatureGuard,
      ],
      controllers: [ChannelPointsController],
      exports: [ChannelPointsService],
    };
  }
}
