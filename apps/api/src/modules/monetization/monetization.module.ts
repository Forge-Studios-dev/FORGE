import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Video } from '../content/entities/video.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { SuperThanks } from '../billing/entities/super-thanks.entity';
import { StreamMessage } from '../stream-chat/entities/stream-message.entity';
import { Stream } from '../streaming/entities/stream.entity';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { UsersModule } from '../users/users.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { MonetizationEligibilityService } from './monetization-eligibility.service';
import { CreatorEarningsService } from './creator-earnings.service';
import { MonetizationController } from './monetization.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Video, WatchHistory, SuperThanks, StreamMessage, Stream]),
    EntitlementsModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [MonetizationController],
  providers: [MonetizationEligibilityService, CreatorEarningsService, CreatorApprovedGuard],
  exports: [MonetizationEligibilityService, CreatorEarningsService],
})
export class MonetizationModule {}
