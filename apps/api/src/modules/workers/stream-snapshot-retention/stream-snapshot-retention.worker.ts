import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { StreamAnalyticsSnapshot } from '../../streaming/entities/stream-analytics-snapshot.entity';
import { STREAM_SNAPSHOT_RETENTION_QUEUE } from './stream-snapshot-retention.constants';

@Processor(STREAM_SNAPSHOT_RETENTION_QUEUE, { concurrency: 1 })
export class StreamSnapshotRetentionWorker extends WorkerHost {
  private readonly logger = new Logger(StreamSnapshotRetentionWorker.name);
  private static readonly BATCH_SIZE = 5000;
  private static readonly MAX_PASSES = 200;

  constructor(
    @InjectRepository(StreamAnalyticsSnapshot)
    private readonly snapshotRepository: Repository<StreamAnalyticsSnapshot>,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const days = this.configService.get<number>('stream.snapshotRetentionDays') ?? 90;
    if (days <= 0) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let totalDeleted = 0;
    for (let pass = 0; pass < StreamSnapshotRetentionWorker.MAX_PASSES; pass++) {
      const deleted = await this.deleteBatch(cutoff, StreamSnapshotRetentionWorker.BATCH_SIZE);
      if (deleted === 0) break;
      totalDeleted += deleted;
    }

    this.logger.log(
      `Stream snapshot retention: deleted ${totalDeleted} rows older than ${days}d`,
    );
  }

  private async deleteBatch(cutoff: Date, batchSize: number): Promise<number> {
    const idSubquery = this.snapshotRepository
      .createQueryBuilder('s')
      .select('s.id')
      .where('s.recordedAt < :cutoff', { cutoff })
      .orderBy('s.recordedAt', 'ASC')
      .limit(batchSize);

    const result = await this.snapshotRepository
      .createQueryBuilder()
      .delete()
      .from(StreamAnalyticsSnapshot)
      .where(`id IN (${idSubquery.getQuery()})`)
      .setParameters(idSubquery.getParameters())
      .execute();

    return result.affected ?? 0;
  }
}
