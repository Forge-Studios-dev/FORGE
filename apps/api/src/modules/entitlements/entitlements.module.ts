import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionTier } from './entities/subscription-tier.entity';
import { MemberSubscription } from './entities/member-subscription.entity';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsController } from './entitlements.controller';
import { EngagementModule } from '../engagement/engagement.module';
import { UsersModule } from '../users/users.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionTier, MemberSubscription]),
    forwardRef(() => EngagementModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [EntitlementsController],
  providers: [EntitlementsService, CreatorApprovedGuard, OptionalJwtAuthGuard],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
