import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { shouldRegisterBullScheduler } from '../../common/bull/scheduler-role.util';
import { SHORTS_WATCH_PERCENT_QUEUE } from './shorts-watch-percent.constants';

const SCHEDULER_ID = 'shorts-watch-percent-recompute';
const HOURLY_MS = 60 * 60 * 1000;
const REGISTER_TIMEOUT_MS = 10_000;

function shouldRegisterScheduler(): boolean {
  return shouldRegisterBullScheduler('DISABLE_SHORTS_WATCH_PERCENT');
}

@Injectable()
export class ShortsWatchPercentScheduler implements OnModuleInit {
  private readonly logger = new Logger(ShortsWatchPercentScheduler.name);

  constructor(@InjectQueue(SHORTS_WATCH_PERCENT_QUEUE) private readonly queue: Queue) {}

  onModuleInit() {
    if (!shouldRegisterScheduler()) {
      this.logger.log('Shorts watch-percent scheduler skipped for this process role');
      return;
    }
    void this.registerScheduler();
  }

  private async registerScheduler(): Promise<void> {
    try {
      await Promise.race([
        this.queue.upsertJobScheduler(
          SCHEDULER_ID,
          { every: HOURLY_MS },
          {
            name: 'run',
            data: {},
            opts: {
              removeOnComplete: { age: 7 * 3600, count: 24 },
              removeOnFail: { age: 7 * 3600, count: 24 },
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
      this.logger.log('Shorts watch-percent repeatable job registered (hourly)');
    } catch (err) {
      this.logger.warn(`Could not register shorts watch-percent scheduler: ${(err as Error).message}`);
    }
  }
}
