import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { shouldRegisterBullScheduler } from '../../common/bull/scheduler-role.util';
import { SCHEDULED_PUBLISH_QUEUE } from './scheduled-publish.constants';

const SCHEDULER_ID = 'scheduled-publish-scan';
const SCAN_INTERVAL_MS = 60 * 1000;
const REGISTER_TIMEOUT_MS = 10_000;

function shouldRegisterScheduler(): boolean {
  return shouldRegisterBullScheduler('DISABLE_SCHEDULED_PUBLISH');
}

@Injectable()
export class ScheduledPublishScheduler implements OnModuleInit {
  private readonly logger = new Logger(ScheduledPublishScheduler.name);

  constructor(@InjectQueue(SCHEDULED_PUBLISH_QUEUE) private readonly queue: Queue) {}

  onModuleInit() {
    if (!shouldRegisterScheduler()) {
      this.logger.log('Scheduled publish scanner skipped for this process role');
      return;
    }
    void this.registerScheduler();
  }

  private async registerScheduler(): Promise<void> {
    try {
      await Promise.race([
        this.queue.upsertJobScheduler(
          SCHEDULER_ID,
          { every: SCAN_INTERVAL_MS },
          {
            name: 'run',
            data: {},
            opts: {
              removeOnComplete: { age: 3600, count: 50 },
              removeOnFail: { age: 3600, count: 50 },
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
      this.logger.log('Scheduled publish repeatable job registered (every 1m)');
    } catch (err) {
      this.logger.warn(`Could not register scheduled publish scanner: ${(err as Error).message}`);
    }
  }
}
