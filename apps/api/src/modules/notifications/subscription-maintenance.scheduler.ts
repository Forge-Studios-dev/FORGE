import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { shouldRegisterBullScheduler } from '../../common/bull/scheduler-role.util';
import { SUBSCRIPTION_MAINTENANCE_QUEUE } from './subscription-maintenance.constants';

const SCHEDULER_ID = 'subscription-maintenance-hourly';
const HOURLY_MS = 60 * 60 * 1000;
const REGISTER_TIMEOUT_MS = 10_000;

function shouldRegisterScheduler(): boolean {
  return shouldRegisterBullScheduler('DISABLE_SUBSCRIPTION_MAINTENANCE');
}

@Injectable()
export class SubscriptionMaintenanceScheduler implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionMaintenanceScheduler.name);

  constructor(
    @InjectQueue(SUBSCRIPTION_MAINTENANCE_QUEUE)
    private readonly queue: Queue,
  ) {}

  onModuleInit() {
    if (!shouldRegisterScheduler()) {
      this.logger.log('Subscription maintenance scheduler skipped for this process role');
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
              removeOnComplete: { age: 86400, count: 48 },
              removeOnFail: { age: 7 * 86400, count: 100 },
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
      this.logger.log('Subscription maintenance repeatable job registered (hourly)');
    } catch (err) {
      this.logger.warn(
        `Could not register subscription maintenance scheduler: ${(err as Error).message}`,
      );
    }
  }
}
