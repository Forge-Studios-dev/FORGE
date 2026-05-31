import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import {
  ANALYTICS_MAX_PROPERTIES_BYTES,
  isAllowedAnalyticsEvent,
} from '@forge/shared-types';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { IngestEventDto } from './dto/ingest-event.dto';
import { ANALYTICS_INGEST_QUEUE } from './analytics-ingest.constants';
import type { AnalyticsIngestJob } from '../workers/analytics-ingest/analytics-ingest.worker';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsRepository: Repository<AnalyticsEvent>,
    @InjectQueue(ANALYTICS_INGEST_QUEUE)
    private readonly analyticsQueue: Queue<AnalyticsIngestJob>,
  ) {}

  async ingest(userId: string | null, dto: IngestEventDto) {
    if (!isAllowedAnalyticsEvent(dto.eventName)) {
      throw new BadRequestException(`Unknown analytics event: ${dto.eventName}`);
    }
    if (dto.properties) {
      const size = Buffer.byteLength(JSON.stringify(dto.properties), 'utf8');
      if (size > ANALYTICS_MAX_PROPERTIES_BYTES) {
        throw new BadRequestException('Analytics properties payload too large');
      }
    }
    await this.analyticsQueue.add(
      'ingest',
      {
        eventName: dto.eventName,
        properties: dto.properties ?? null,
        userId,
        videoId: dto.videoId ?? null,
      },
      {
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  async summarySince(since: Date) {
    const qb = this.analyticsRepository
      .createQueryBuilder('e')
      .select('e.eventName', 'eventName')
      .addSelect('COUNT(*)', 'count')
      .where('e.createdAt >= :since', { since })
      .groupBy('e.eventName');

    const byEvent = await qb.getRawMany<{ eventName: string; count: string }>();
    const totalEvents = await this.analyticsRepository
      .createQueryBuilder('e')
      .where('e.createdAt >= :since', { since })
      .getCount();

    return { since: since.toISOString(), totalEvents, byEvent };
  }
}
