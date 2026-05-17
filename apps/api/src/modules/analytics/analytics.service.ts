import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { IngestEventDto } from './dto/ingest-event.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsRepository: Repository<AnalyticsEvent>,
  ) {}

  async ingest(userId: string | null, dto: IngestEventDto) {
    await this.analyticsRepository.save(
      this.analyticsRepository.create({
        eventName: dto.eventName,
        properties: dto.properties ?? null,
        userId,
        videoId: dto.videoId ?? null,
      }),
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
