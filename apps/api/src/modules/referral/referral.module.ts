import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserReferral, UserReferralCode } from './entities/referral.entity';
import { ReferralService } from './referral.service';
import { ReferralController } from './referral.controller';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserReferralCode, UserReferral]),
    GamificationModule.register(),
  ],
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
