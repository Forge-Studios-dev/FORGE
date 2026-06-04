import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from './entities/analytics-event.entity';

const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_BATCH_SIZE = 5000;
const MAX_BATCH_SIZE = 50_000;

@Injectable()
export class AnalyticsRetentionService {
  private readonly logger = new Logger(AnalyticsRetentionService.name);

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsRepository: Repository<AnalyticsEvent>,
  ) {}

  /** Invoked by BullMQ worker (daily repeatable job). */
  async runRetention(): Promise<void> {
    const retentionDays = this.retentionDays();
    if (retentionDays <= 0) {
      this.logger.debug('Analytics retention disabled (ANALYTICS_RETENTION_DAYS <= 0)');
      return;
    }

    const batchSize = this.batchSize();
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);

    let totalDeleted = 0;
    try {
      for (let pass = 0; pass < 10_000; pass++) {
        const deleted = await this.deleteBatch(cutoff, batchSize);
        if (deleted === 0) break;
        totalDeleted += deleted;
      }
      if (totalDeleted > 0) {
        this.logger.log(
          `Analytics retention removed ${totalDeleted} events older than ${retentionDays}d (cutoff ${cutoff.toISOString()})`,
        );
      }
    } catch (err) {
      this.logger.warn(`Analytics retention failed: ${(err as Error).message}`);
    }
  }

  private retentionDays(): number {
    if (process.env.DISABLE_ANALYTICS_RETENTION === 'true') return 0;
    const raw = process.env.ANALYTICS_RETENTION_DAYS?.trim();
    if (raw === '' || raw === '0') return 0;
    const parsed = parseInt(raw ?? `${DEFAULT_RETENTION_DAYS}`, 10);
    if (!Number.isFinite(parsed)) return DEFAULT_RETENTION_DAYS;
    return Math.max(0, Math.min(parsed, 3650));
  }

  private batchSize(): number {
    const parsed = parseInt(
      process.env.ANALYTICS_RETENTION_BATCH_SIZE?.trim() ?? `${DEFAULT_BATCH_SIZE}`,
      10,
    );
    if (!Number.isFinite(parsed)) return DEFAULT_BATCH_SIZE;
    return Math.max(100, Math.min(parsed, MAX_BATCH_SIZE));
  }

  private async deleteBatch(cutoff: Date, batchSize: number): Promise<number> {
    const idSubquery = this.analyticsRepository
      .createQueryBuilder('e')
      .select('e.id')
      .where('e.createdAt < :cutoff', { cutoff })
      .orderBy('e.createdAt', 'ASC')
      .limit(batchSize);

    const result = await this.analyticsRepository
      .createQueryBuilder()
      .delete()
      .from(AnalyticsEvent)
      .where(`id IN (${idSubquery.getQuery()})`)
      .setParameters(idSubquery.getParameters())
      .execute();

    return result.affected ?? 0;
  }
}
