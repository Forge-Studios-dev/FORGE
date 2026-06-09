import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { shouldRegisterBullScheduler } from '../../common/bull/scheduler-role.util';
import { STREAM_SNAPSHOT_RETENTION_QUEUE } from '../workers/stream-snapshot-retention/stream-snapshot-retention.constants';

const SCHEDULER_ID = 'stream-snapshot-retention-daily';

@Injectable()
export class StreamSnapshotRetentionScheduler implements OnModuleInit {
  private readonly logger = new Logger(StreamSnapshotRetentionScheduler.name);

  constructor(
    @InjectQueue(STREAM_SNAPSHOT_RETENTION_QUEUE)
    private readonly queue: Queue,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    if (!shouldRegisterBullScheduler('DISABLE_STREAM_SNAPSHOT_RETENTION')) {
      this.logger.log('Stream snapshot retention scheduler skipped for this process role');
      return;
    }
    void this.register();
  }

  private async register(): Promise<void> {
    try {
      await this.queue.add(
        'retention-scan',
        {},
        {
          jobId: SCHEDULER_ID,
          repeat: { pattern: '0 4 * * *' },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
      this.logger.log('Stream snapshot retention scheduler registered (daily 04:00 UTC)');
    } catch (err) {
      this.logger.warn(`Stream snapshot retention scheduler failed: ${(err as Error).message}`);
    }
  }
}
