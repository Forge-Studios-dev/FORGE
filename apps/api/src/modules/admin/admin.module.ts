import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Video } from '../content/entities/video.entity';
import { Report } from '../reports/entities/report.entity';
import { ReportsModule } from '../reports/reports.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { PlaylistsModule } from '../playlists/playlists.module';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { StreamingModule } from '../streaming/streaming.module';
import { StreamChatModule } from '../stream-chat/stream-chat.module';
import { Stream } from '../streaming/entities/stream.entity';
import { Community } from '../communities/entities/community.entity';
import { CommunityReport } from '../communities/entities/community-moderation.entity';
import { CommunityRole } from '../communities/entities/community-role.entity';
import { OAuthAccount } from '../auth/entities/oauth-account.entity';
import { BillingModule } from '../billing/billing.module';
import { DatabaseObservabilityService } from '../../database/database-observability.service';
import { AccountStrikesModule } from '../account-strikes/account-strikes.module';
import { CopyrightModule } from '../copyright/copyright.module';
import { AdminAuditLogModule } from '../../common/audit/admin-audit-log.module';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Video,
      Report,
      Stream,
      Community,
      CommunityReport,
      CommunityRole,
      OAuthAccount,
    ]),
    // AdminModule is imported (directly or transitively) by nearly every
    // other feature module, making it the hub of many require cycles (see
    // madge --circular). Every edge below that madge flagged as part of a
    // cycle is forwardRef'd here so load order can't leave the far side
    // undefined, regardless of which module happens to be required first.
    forwardRef(() => StreamingModule),
    forwardRef(() => StreamChatModule),
    forwardRef(() => ContentModule),
    forwardRef(() => EntitlementsModule),
    ReportsModule,
    forwardRef(() => AnalyticsModule),
    CategoriesModule,
    forwardRef(() => UsersModule),
    forwardRef(() => PlaylistsModule),
    forwardRef(() => AuthModule),
    forwardRef(() => BillingModule),
    forwardRef(() => EngagementModule),
    AccountStrikesModule,
    CopyrightModule,
    AdminAuditLogModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, DatabaseObservabilityService],
  exports: [AdminService],
})
export class AdminModule {}
