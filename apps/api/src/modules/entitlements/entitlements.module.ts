import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionTier } from './entities/subscription-tier.entity';
import { MemberSubscription } from './entities/member-subscription.entity';
import { TierEntitlement } from './entities/tier-entitlement.entity';
import { CreatorBundle, CreatorBundleItem } from './entities/creator-bundle.entity';
import { CreatorBundlesService } from './creator-bundles.service';
import { StreamEventPurchase } from '../streaming/entities/stream-event-purchase.entity';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsAnalyticsService } from './entitlements-analytics.service';
import { EntitlementsController } from './entitlements.controller';
import { EngagementModule } from '../engagement/engagement.module';
import { UsersModule } from '../users/users.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { SkillEconomyLmsGuard } from '../../common/guards/skill-economy-lms.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { StripeTierSyncModule } from '../billing/stripe-tier-sync.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionTier,
      MemberSubscription,
      TierEntitlement,
      CreatorBundle,
      CreatorBundleItem,
      StreamEventPurchase,
    ]),
    forwardRef(() => EngagementModule),
    forwardRef(() => UsersModule),
    // Previously forwardRef(() => BillingModule) purely to reach
    // StripeTierSyncService — that service now lives in its own leaf
    // module (see stripe-tier-sync.module.ts), which removes the
    // Billing<->Entitlements module cycle entirely.
    StripeTierSyncModule,
  ],
  controllers: [EntitlementsController],
  providers: [
    EntitlementsService,
    EntitlementsAnalyticsService,
    CreatorBundlesService,
    CreatorApprovedGuard,
    OptionalJwtAuthGuard,
    SkillEconomyLmsGuard,
  ],
  exports: [EntitlementsService, EntitlementsAnalyticsService, CreatorBundlesService],
})
export class EntitlementsModule {}
