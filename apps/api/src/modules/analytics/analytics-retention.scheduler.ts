import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ANALYTICS_RETENTION_QUEUE } from './analytics-retention.constants';

const SCHEDULER_ID = 'analytics-retention-daily';
const DAILY_MS = 24 * 60 * 60 * 1000;
const REGISTER_TIMEOUT_MS = 10_000;

function shouldRegisterScheduler(): boolean {
  if (process.env.DISABLE_ANALYTICS_RETENTION === 'true') return false;
  if (process.env.WORKER_ONLY === 'true') return true;
  if (process.env.NODE_ENV === 'production') return false;
  return true;
}

@Injectable()
export class AnalyticsRetentionScheduler implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsRetentionScheduler.name);

  constructor(
    @InjectQueue(ANALYTICS_RETENTION_QUEUE)
    private readonly queue: Queue,
  ) {}

  onModuleInit() {
    if (!shouldRegisterScheduler()) {
      this.logger.log('Analytics retention scheduler skipped for this process role');
      return;
    }
    void this.registerScheduler();
  }

  private async registerScheduler(): Promise<void> {
    try {
      await Promise.race([
        this.queue.upsertJobScheduler(
          SCHEDULER_ID,
          { every: DAILY_MS },
          {
            name: 'run',
            data: {},
            opts: {
              removeOnComplete: { age: 7 * 86400, count: 14 },
              removeOnFail: { age: 7 * 86400, count: 50 },
            },
          },
        ),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`scheduler registration timed out after ${REGISTER_TIMEOUT_MS}ms`)),
            REGISTER_TIMEOUT_MS,
          ),
        ),
      ]);
      this.logger.log('Analytics retention repeatable job registered (daily)');
    } catch (err) {
      this.logger.warn(
        `Could not register analytics retention scheduler: ${(err as Error).message}`,
      );
    }
  }
}
