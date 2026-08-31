import { DynamicModule, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberBadge, MemberXp, PlatformXp, PlatformXpGrant, UserAchievement } from './entities/gamification.entity';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { GamificationListener } from './gamification.listener';
import { CommunitiesModule } from '../communities/communities.module';
import { EngagementModule } from '../engagement/engagement.module';
import { SkillEconomyLmsGuard } from '../../common/guards/skill-economy-lms.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { isSkillEconomyLmsEnabled } from '../../common/features/skill-economy-lms';

/**
 * XP / achievements. Service stays registered for referral hooks;
 * HTTP controller only mounts when FEATURES_SKILL_ECONOMY_LMS=true.
 */
@Module({})
export class GamificationModule {
  static register(): DynamicModule {
    const imports = [
      TypeOrmModule.forFeature([MemberXp, MemberBadge, PlatformXp, PlatformXpGrant, UserAchievement]),
      forwardRef(() => CommunitiesModule),
      forwardRef(() => EngagementModule),
    ];
    const providers = [GamificationService, GamificationListener];
    if (!isSkillEconomyLmsEnabled()) {
      return {
        module: GamificationModule,
        imports,
        providers,
        exports: [GamificationService],
      };
    }
    return {
      module: GamificationModule,
      imports,
      controllers: [GamificationController],
      providers: [...providers, SkillEconomyLmsGuard, OptionalJwtAuthGuard],
      exports: [GamificationService],
    };
  }
}
