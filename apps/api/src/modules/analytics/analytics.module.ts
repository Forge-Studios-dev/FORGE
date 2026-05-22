import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { ANALYTICS_INGEST_QUEUE } from './analytics-ingest.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalyticsEvent]),
    JwtModule.register({}),
    BullModule.registerQueue({ name: ANALYTICS_INGEST_QUEUE }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
