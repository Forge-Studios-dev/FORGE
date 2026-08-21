import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { ANALYTICS_INGEST_QUEUE } from './analytics-ingest.constants';
import { ANALYTICS_RETENTION_QUEUE } from './analytics-retention.constants';
import { AnalyticsRetentionService } from './analytics-retention.service';
import { AnalyticsRetentionScheduler } from './analytics-retention.scheduler';
import { KpiService } from './kpi.service';
import { CommunitiesModule } from '../communities/communities.module';
import { CommunityRole } from '../communities/entities/community-role.entity';
import { Community } from '../communities/entities/community.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalyticsEvent, CommunityRole, Community]),
    BullModule.registerQueue({ name: ANALYTICS_INGEST_QUEUE }),
    BullModule.registerQueue({ name: ANALYTICS_RETENTION_QUEUE }),
    CommunitiesModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRetentionService, AnalyticsRetentionScheduler, KpiService],
  exports: [AnalyticsService, AnalyticsRetentionService, KpiService],
})
export class AnalyticsModule {}
