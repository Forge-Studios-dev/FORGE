import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionTier } from './entities/subscription-tier.entity';
import { MemberSubscription } from './entities/member-subscription.entity';
import { TierEntitlement } from './entities/tier-entitlement.entity';
import { CreatorBundle, CreatorBundleItem } from './entities/creator-bundle.entity';
import { CreatorBundlesService } from './creator-bundles.service';
import { CreatorBundlesController } from './creator-bundles.controller';
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
import { isSkillEconomyLmsEnabled } from '../../common/features/skill-economy-lms';

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
    StripeTierSyncModule,
  ],
  controllers: [
    EntitlementsController,
    ...(isSkillEconomyLmsEnabled() ? [CreatorBundlesController] : []),
  ],
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
