import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { shouldRegisterBullScheduler } from '../../common/bull/scheduler-role.util';
import { ACCOUNT_PURGE_QUEUE } from './account-purge.constants';

const SCHEDULER_ID = 'account-purge-daily';
const DAILY_MS = 24 * 60 * 60 * 1000;
const REGISTER_TIMEOUT_MS = 10_000;

function shouldRegisterScheduler(): boolean {
  return shouldRegisterBullScheduler('DISABLE_ACCOUNT_PURGE');
}

@Injectable()
export class AccountPurgeScheduler implements OnModuleInit {
  private readonly logger = new Logger(AccountPurgeScheduler.name);

  constructor(@InjectQueue(ACCOUNT_PURGE_QUEUE) private readonly queue: Queue) {}

  onModuleInit() {
    if (!shouldRegisterScheduler()) {
      this.logger.log('Account purge scheduler skipped for this process role');
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
              removeOnComplete: { age: 7 * 86400, count: 30 },
              removeOnFail: { age: 7 * 86400, count: 30 },
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
      this.logger.log('Account purge repeatable job registered (daily)');
    } catch (err) {
      this.logger.warn(`Could not register account purge scheduler: ${(err as Error).message}`);
    }
  }
}
