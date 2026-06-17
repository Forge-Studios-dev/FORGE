import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionTier } from './entities/subscription-tier.entity';
import { MemberSubscription } from './entities/member-subscription.entity';
import { TierEntitlement } from './entities/tier-entitlement.entity';
import { StreamEventPurchase } from '../streaming/entities/stream-event-purchase.entity';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsController } from './entitlements.controller';
import { EngagementModule } from '../engagement/engagement.module';
import { UsersModule } from '../users/users.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionTier, MemberSubscription, TierEntitlement, StreamEventPurchase]),
    forwardRef(() => EngagementModule),
    forwardRef(() => UsersModule),
    forwardRef(() => BillingModule),
  ],
  controllers: [EntitlementsController],
  providers: [EntitlementsService, CreatorApprovedGuard, OptionalJwtAuthGuard],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
