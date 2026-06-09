import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { LessThan, Repository } from 'typeorm';
import { StreamAnalyticsSnapshot } from '../../streaming/entities/stream-analytics-snapshot.entity';
import { STREAM_SNAPSHOT_RETENTION_QUEUE } from './stream-snapshot-retention.constants';

@Processor(STREAM_SNAPSHOT_RETENTION_QUEUE)
export class StreamSnapshotRetentionWorker extends WorkerHost {
  private readonly logger = new Logger(StreamSnapshotRetentionWorker.name);

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

    const result = await this.snapshotRepository.delete({
      recordedAt: LessThan(cutoff),
    });

    this.logger.log(`Stream snapshot retention: deleted ${result.affected ?? 0} rows older than ${days}d`);
  }
}
