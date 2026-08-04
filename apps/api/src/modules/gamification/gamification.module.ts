import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberBadge, MemberXp, PlatformXp, PlatformXpGrant, UserAchievement } from './entities/gamification.entity';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { GamificationListener } from './gamification.listener';
import { CommunitiesModule } from '../communities/communities.module';
import { SkillEconomyLmsGuard } from '../../common/guards/skill-economy-lms.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([MemberXp, MemberBadge, PlatformXp, PlatformXpGrant, UserAchievement]),
    forwardRef(() => CommunitiesModule),
  ],
  controllers: [GamificationController],
  providers: [GamificationService, GamificationListener, SkillEconomyLmsGuard, OptionalJwtAuthGuard],
  exports: [GamificationService],
})
export class GamificationModule {}
