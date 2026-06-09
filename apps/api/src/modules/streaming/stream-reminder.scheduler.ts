import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { shouldRegisterBullScheduler } from '../../common/bull/scheduler-role.util';
import { STREAM_REMINDER_QUEUE } from '../workers/stream-reminder/stream-reminder.constants';

const SCHEDULER_ID = 'stream-reminder-scan';
const INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class StreamReminderScheduler implements OnModuleInit {
  private readonly logger = new Logger(StreamReminderScheduler.name);

  constructor(@InjectQueue(STREAM_REMINDER_QUEUE) private readonly queue: Queue) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    if (!shouldRegisterBullScheduler()) {
      this.logger.log('Stream reminder scheduler skipped for this process role');
      return;
    }
    void this.registerScheduler();
  }

  private async registerScheduler(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        SCHEDULER_ID,
        { every: INTERVAL_MS },
        {
          name: 'scan',
          data: {},
          opts: { removeOnComplete: { age: 3600, count: 100 } },
        },
      );
      this.logger.log('Stream reminder scheduler registered (every 5m)');
    } catch (err) {
      this.logger.warn(`Stream reminder scheduler failed: ${(err as Error).message}`);
    }
  }
}
