import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberBadge, MemberXp, PlatformXp, PlatformXpGrant, UserAchievement } from './entities/gamification.entity';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { GamificationListener } from './gamification.listener';
import { CommunitiesModule } from '../communities/communities.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MemberXp, MemberBadge, PlatformXp, PlatformXpGrant, UserAchievement]),
    forwardRef(() => CommunitiesModule),
  ],
  controllers: [GamificationController],
  providers: [GamificationService, GamificationListener],
  exports: [GamificationService],
})
export class GamificationModule {}
